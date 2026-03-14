import { Product } from "@prisma/client";
import { NotFoundError } from "../../utils/errors";
import {
    buildPagination,
    PaginatedResult,
} from "../../utils/helpers/pagination";
import { productRepository } from "./product.repository";
import { ProductFilter } from "./product.types";

export const productService = {
  async getAll(filters: ProductFilter): Promise<PaginatedResult<Product>> {
    const { items, total } = await productRepository.findAll(filters);
    return {
      data: items,
      pagination: buildPagination(filters.page, filters.limit, total),
    };
  },

  async getById(id: string): Promise<Product> {
    const product = await productRepository.findById(id);
    if (!product) throw new NotFoundError("Product");
    return product;
  },
};
