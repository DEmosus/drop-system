import type { Prisma } from "@prisma/client";
import cron from "node-cron";
import { CRON_EVERY_MINUTE } from "../config/constants";
import { prisma } from "../config/prisma";
import { inventoryRepository } from "../modules/inventory/inventory.repository";
import { productRepository } from "../modules/product/product.repository";
import { reservationRepository } from "../modules/reservation/reservation.repository";
import { logger } from "../utils/logger/logger";
import { metricsStore } from "../utils/metrics/metrics.store";

async function processExpiredReservation(reservationId: string): Promise<void> {
  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const reservation = await reservationRepository.findByIdForUpdate(
        reservationId,
        tx,
      );
      if (!reservation) return;
      if (reservation.status !== "PENDING") return;
      if (reservation.expiresAt > new Date()) return;

      await tx.reservation.update({
        where: { id: reservationId },
        data: { status: "EXPIRED" },
      });
      await productRepository.updateAvailableStock(
        reservation.productId,
        reservation.quantity,
        tx,
      );
      await inventoryRepository.log(
        {
          productId: reservation.productId,
          change: reservation.quantity,
          reason: "EXPIRATION",
          referenceId: reservationId,
        },
        tx,
      );

      logger.debug(
        {
          reservationId,
          userId: reservation.userId,
          productId: reservation.productId,
          quantity: reservation.quantity,
        },
        "Reservation expired — stock restored",
      );
    },
    { isolationLevel: "Serializable", maxWait: 3000, timeout: 8000 },
  );
}

async function runExpirationSweep(): Promise<void> {
  const expired = await reservationRepository.findExpired();
  if (expired.length === 0) return;

  logger.info({ count: expired.length }, "Processing expired reservations");

  const results = await Promise.allSettled(
    expired.map((r) => processExpiredReservation(r.id)),
  );

  let succeeded = 0;
  let failed = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      succeeded++;
      metricsStore.increment("expiredReservations");
    } else {
      failed++;
      logger.error({ reason: result.reason }, "Failed to expire reservation");
    }
  }

  logger.info({ succeeded, failed }, "Expiration sweep complete");
}

export function startExpirationWorker(): void {
  cron.schedule(CRON_EVERY_MINUTE, async () => {
    try {
      await runExpirationSweep();
    } catch (err) {
      logger.error({ err }, "Expiration worker crashed — will retry next tick");
    }
  });
}
