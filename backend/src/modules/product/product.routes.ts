import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../utils/helpers/asyncHandler";
import { productFilterSchema } from "../../validators/product.schema";
import { productController } from "./product.controller";

export const productRouter = Router();

productRouter.get(
  "/",
  validate(productFilterSchema, "query"),
  asyncHandler(productController.getAll),
);
productRouter.get("/:id", asyncHandler(productController.getById));
