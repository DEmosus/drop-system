import { z } from "zod";

export const reserveSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be positive")
    .max(10, "Maximum 10 units per reservation"),
});

export const checkoutSchema = z.object({
  reservationId: z.string().uuid("Invalid reservation ID"),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ReserveInput = z.infer<typeof reserveSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
