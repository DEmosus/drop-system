import { Prisma } from "@prisma/client";

import { env } from "../../config/env";
import { prisma } from "../../config/prisma";

import { inventoryRepository } from "../inventory/inventory.repository";
import { productRepository } from "../product/product.repository";
import { reservationRepository } from "./reservation.repository";

import {
  ConflictError,
  DuplicateReservationError,
  InsufficientStockError,
  NotFoundError,
  ReservationExpiredError,
  ValidationError,
} from "../../utils/errors";

import { logger } from "../../utils/logger/logger";
import { metricsStore } from "../../utils/metrics/metrics.store";
import { CheckoutResult, ReserveResult } from "./reservation.types";

const SERIALIZABLE_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 10;

function isSerializationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  // Prisma wraps pg error code 40001 as P2034
  if (e["code"] === "P2034") return true;
  const msg = String(e["message"] ?? "");
  return msg.includes("40001") || msg.includes("could not serialize");
}

function isUniqueConstraintError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  return e["code"] === "P2002";
}

async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  retries = SERIALIZABLE_RETRIES,
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isSerializationError(err) && attempt < retries - 1) {
        await new Promise((r) =>
          setTimeout(r, RETRY_BASE_DELAY_MS * (attempt + 1)),
        );
        continue;
      }
      throw err;
    }
  }
  // Unreachable, but satisfies TypeScript
  throw new Error("withSerializableRetry: exhausted retries");
}

export const reservationService = {
  async reserve(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<ReserveResult> {
    if (quantity <= 0) {
      throw new ValidationError("Quantity must be greater than 0");
    }

    const existing =
      await reservationRepository.findActivePendingByUserAndProduct(
        userId,
        productId,
      );

    if (existing) {
      throw new DuplicateReservationError();
    }

    const result = await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const product = await productRepository.findByIdForUpdate(
            productId,
            tx,
          );

          if (!product) {
            throw new NotFoundError("Product");
          }

          if (product.availableStock < quantity) {
            metricsStore.increment("failedReservations");
            throw new InsufficientStockError();
          }

          await productRepository.updateAvailableStock(
            productId,
            -quantity,
            tx,
          );

          const expiresAt = new Date(
            Date.now() + env.RESERVATION_EXPIRY_MINUTES * 60 * 1000,
          );

          const reservation = await reservationRepository.create(
            {
              userId,
              productId,
              quantity,
              expiresAt,
            },
            tx,
          );

          await inventoryRepository.log(
            {
              productId,
              change: -quantity,
              reason: "RESERVATION",
              referenceId: reservation.id,
            },
            tx,
          );

          return { reservation, expiresAt };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        },
      ),
    );

    metricsStore.increment("totalReservations");

    logger.info(
      {
        reservationId: result.reservation.id,
        userId,
        productId,
        quantity,
      },
      "Reservation created",
    );

    return {
      reservationId: result.reservation.id,
      expiresAt: result.expiresAt,
      expiresInSeconds: Math.floor(
        (result.expiresAt.getTime() - Date.now()) / 1000,
      ),
    };
  },

  async checkout(
    reservationId: string,
    userId: string,
  ): Promise<CheckoutResult> {
    const result = await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const reservation = await reservationRepository.findByIdWithTx(
            reservationId,
            tx,
          );

          if (!reservation) throw new NotFoundError("Reservation");

          if (reservation.userId !== userId) {
            throw new ValidationError(
              "This reservation does not belong to you",
            );
          }

          if (reservation.status !== "PENDING") {
            if (reservation.status === "EXPIRED") {
              throw new ReservationExpiredError();
            }

            throw new ConflictError(
              `Reservation already ${reservation.status.toLowerCase()}`,
            );
          }

          if (reservation.expiresAt < new Date()) {
            await reservationRepository.updateStatus(
              reservationId,
              "EXPIRED",
              tx,
            );
            throw new ReservationExpiredError();
          }

          let order;

          try {
            order = await tx.order.create({
              data: {
                userId: reservation.userId,
                reservationId: reservation.id,
                productId: reservation.productId,
                quantity: reservation.quantity,
                status: "CONFIRMED",
              },
            });
          } catch (err) {
            if (isUniqueConstraintError(err)) {
              throw new ConflictError("Reservation already checked out");
            }
            throw err;
          }

          await reservationRepository.updateStatus(
            reservationId,
            "COMPLETED",
            tx,
          );

          await inventoryRepository.log(
            {
              productId: reservation.productId,
              change: 0,
              reason: "CHECKOUT",
              referenceId: order.id,
            },
            tx,
          );

          return { orderId: order.id };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        },
      ),
    );

    metricsStore.increment("completedCheckouts");

    logger.info(
      {
        reservationId,
        userId,
        orderId: result.orderId,
      },
      "Checkout completed",
    );

    return result;
  },

  async cancel(reservationId: string, userId: string): Promise<void> {
    await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const reservation = await reservationRepository.findByIdWithTx(
            reservationId,
            tx,
          );

          if (!reservation) throw new NotFoundError("Reservation");

          if (reservation.userId !== userId) {
            throw new ValidationError("Not your reservation");
          }

          if (reservation.status !== "PENDING") {
            throw new ConflictError(
              "Only pending reservations can be cancelled",
            );
          }

          await reservationRepository.updateStatus(
            reservationId,
            "CANCELLED",
            tx,
          );

          await productRepository.updateAvailableStock(
            reservation.productId,
            reservation.quantity,
            tx,
          );

          await inventoryRepository.log(
            {
              productId: reservation.productId,
              change: reservation.quantity,
              reason: "CANCELLATION",
              referenceId: reservationId,
            },
            tx,
          );
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        },
      ),
    );

    metricsStore.increment("cancelledReservations");
  },

  async getByUser(userId: string, page: number, limit: number) {
    return reservationRepository.findByUser(userId, page, limit);
  },
};
