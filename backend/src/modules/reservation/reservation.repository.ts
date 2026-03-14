import { Prisma, Reservation, ReservationStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { buildSkip } from "../../utils/helpers/pagination";

export const reservationRepository = {
  /** Create a new pending reservation (inside tx) */
  async create(
    data: {
      userId: string;
      productId: string;
      quantity: number;
      expiresAt: Date;
    },
    tx: Prisma.TransactionClient,
  ): Promise<Reservation> {
    return tx.reservation.create({
      data: { ...data, status: "PENDING" },
    });
  },

  /** Find reservation by ID */
  async findById(id: string): Promise<Reservation | null> {
    return prisma.reservation.findUnique({ where: { id } });
  },

  /** Lock reservation row for update — must be inside a transaction */
  async findByIdForUpdate(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<Reservation | null> {
    const rows = await tx.$queryRaw<Reservation[]>`
      SELECT * FROM "Reservation" WHERE id = ${id} FOR UPDATE
    `;
    return rows[0] ?? null;
  },

  /** Find reservation by ID with transaction (for checkout/cancel) */
  async findByIdWithTx(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<Reservation | null> {
    return tx.reservation.findUnique({ where: { id } });
  },

  /** Check if user already has an active pending reservation for this product */
  async findActivePendingByUserAndProduct(
    userId: string,
    productId: string,
  ): Promise<Reservation | null> {
    return prisma.reservation.findFirst({
      where: {
        userId,
        productId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });
  },

  /** Update reservation status (optional transaction) */
  async updateStatus(
    id: string,
    status: ReservationStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<Reservation> {
    const client = tx ?? prisma;
    return client.reservation.update({
      where: { id },
      data: { status },
    });
  },

  /** Find all pending reservations past their expiry (for the worker) */
  async findExpired(): Promise<Reservation[]> {
    return prisma.reservation.findMany({
      where: { status: "PENDING", expiresAt: { lt: new Date() } },
    });
  },

  /** Find reservations for a user (with pagination) */
  async findByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: Reservation[]; total: number }> {
    const where = { userId };
    const [items, total] = await prisma.$transaction([
      prisma.reservation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: buildSkip(page, limit),
        take: limit,
        include: { product: true },
      }),
      prisma.reservation.count({ where }),
    ]);
    return { items, total };
  },
};
