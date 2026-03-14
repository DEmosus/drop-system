import { InventoryLogReason } from "@prisma/client";

export interface CreateInventoryLogInput {
  productId: string;
  change: number;
  reason: InventoryLogReason;
  referenceId?: string;
}

export interface InventoryLogResponse {
  id: string;
  productId: string;
  change: number;
  reason: InventoryLogReason;
  referenceId: string | null;
  createdAt: Date;
}
