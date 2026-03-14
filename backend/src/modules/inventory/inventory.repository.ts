import { InventoryLog, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { CreateInventoryLogInput } from "./inventory.types";

export const inventoryRepository = {
  async log(
    input: CreateInventoryLogInput,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryLog> {
    const client = tx ?? prisma;

    return client.inventoryLog.create({
      data: input,
    });
  },

  async findByProduct(productId: string, limit = 50): Promise<InventoryLog[]> {
    return prisma.inventoryLog.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  async findByReference(referenceId: string): Promise<InventoryLog[]> {
    return prisma.inventoryLog.findMany({
      where: { referenceId },
      orderBy: { createdAt: "desc" },
    });
  },
};
