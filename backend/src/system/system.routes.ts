import { Router } from "express";
import { asyncHandler } from "../utils/helpers/asyncHandler";
import { healthController } from "./health.controller";
import { metricsController } from "./metrics.controller";

export const systemRouter = Router();

systemRouter.get("/health", asyncHandler(healthController.check));
systemRouter.get("/metrics", metricsController.get);
