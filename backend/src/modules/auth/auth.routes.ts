import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../utils/helpers/asyncHandler";
import { loginSchema, registerSchema } from "../../validators/auth.schema";
import { authController } from "./auth.controller";

export const authRouter = Router();

authRouter.post(
  "/register",
  validate(registerSchema),
  asyncHandler(authController.register),
);
authRouter.post(
  "/login",
  validate(loginSchema),
  asyncHandler(authController.login),
);
