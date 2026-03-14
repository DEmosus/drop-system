import { Order, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { buildSkip } from "../../utils/helpers/pagination";
import { CreateOrderInput } from "./order.types";

export const orderRepository = {
  async create(
    input: CreateOrderInput,
    tx: Prisma.TransactionClient,
  ): Promise<Order> {
    return tx.order.create({
      data: {
        userId: input.userId,
        reservationId: input.reservationId,
        productId: input.productId,
        quantity: input.quantity,
        status: "CONFIRMED",
      },
    });
  },

  async findById(id: string): Promise<Order | null> {
    return prisma.order.findUnique({ where: { id } });
  },

  async findByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: Order[]; total: number }> {
    const where = { userId };
    const [items, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: buildSkip(page, limit),
        take: limit,
        include: { product: true },
      }),
      prisma.order.count({ where }),
    ]);
    return { items, total };
  },
};
