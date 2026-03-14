import { Order, Prisma } from "@prisma/client";
import { orderRepository } from "./order.repository";
import { CreateOrderInput } from "./order.types";

export const orderService = {
  async create(
    input: CreateOrderInput,
    tx: Prisma.TransactionClient,
  ): Promise<Order> {
    return orderRepository.create(input, tx);
  },
};
