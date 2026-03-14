import { Prisma, Product } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { buildSkip } from "../../utils/helpers/pagination";
import { ProductFilter } from "./product.types";

export const productRepository = {
  async findById(id: string): Promise<Product | null> {
    return prisma.product.findUnique({ where: { id } });
  },

  /** Lock row for update — must be called inside a transaction */
  async findByIdForUpdate(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<Product | null> {
    const rows = await tx.$queryRaw<Product[]>`
      SELECT * FROM "Product" WHERE id = ${id} FOR UPDATE
    `;
    return rows[0] ?? null;
  },

  async findAll(
    filters: ProductFilter,
  ): Promise<{ items: Product[]; total: number }> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      minPrice,
      maxPrice,
      inStock,
    } = filters;

    const where: Prisma.ProductWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(minPrice !== undefined && { price: { gte: minPrice } }),
      ...(maxPrice !== undefined && { price: { lte: maxPrice } }),
      ...(inStock === true && { availableStock: { gt: 0 } }),
      ...(inStock === false && { availableStock: { equals: 0 } }),
    };

    const allowedSortFields = ["name", "price", "availableStock", "createdAt"];
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sortBy && allowedSortFields.includes(sortBy)
        ? { [sortBy]: sortOrder }
        : { createdAt: sortOrder };

    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy,
        skip: buildSkip(page, limit),
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  },

  async updateAvailableStock(
    id: string,
    delta: number,
    tx: Prisma.TransactionClient,
  ): Promise<Product> {
    return tx.product.update({
      where: { id },
      data: { availableStock: { increment: delta } },
    });
  },
};
