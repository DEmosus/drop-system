import { Request, Response } from "express";
import { HTTP_STATUS } from "../../config/constants";
import { productService } from "./product.service";

export const productController = {
  async getAll(req: Request, res: Response): Promise<void> {
    // query params already coerced by zod validate middleware
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await productService.getAll(req.query as any);
    res.status(HTTP_STATUS.OK).json({ success: true, ...result });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const id = req.params["id"] as string;
    const product = await productService.getById(id);
    res.status(HTTP_STATUS.OK).json({ success: true, data: product });
  },
};
