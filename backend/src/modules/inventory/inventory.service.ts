import { Prisma } from "@prisma/client";
import { inventoryRepository } from "./inventory.repository";
import { CreateInventoryLogInput } from "./inventory.types";

export const inventoryService = {
  async log(
    input: CreateInventoryLogInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await inventoryRepository.log(input, tx);
  },

  async getProductLogs(productId: string) {
    return inventoryRepository.findByProduct(productId);
  },

  async getReferenceLogs(referenceId: string) {
    return inventoryRepository.findByReference(referenceId);
  },
};
