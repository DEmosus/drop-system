import cors from "cors";
import express, { Application, NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { errorHandler } from "../middleware/errorHandler.middleware";
import { globalRateLimit } from "../middleware/rateLimit.middleware";
import { requestLogger } from "../middleware/requestLogger.middleware";

// ── Module routers ────────────────────────────────────────────────────────────
import { authRouter } from "../modules/auth/auth.routes";
import { productRouter } from "../modules/product/product.routes";
import { reservationRouter } from "../modules/reservation/reservation.routes";
import { systemRouter } from "../system/system.routes";

export function createApp(): Application {
  const app = express();
  app.set("trust proxy", 1);

  // ── Core middleware ─────────────────────────────────────────────────────────
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(globalRateLimit);
  app.use(requestLogger);

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use("/api/auth", authRouter);
  app.use("/api/products", productRouter);
  app.use("/api", reservationRouter);
  app.use("/", systemRouter);

  // ── 404 handler ─────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res
      .status(404)
      .json({ success: false, code: "NOT_FOUND", message: "Route not found" });
  });

  // ── Error handler (must be last) ────────────────────────────────────────────
  app.use(
    errorHandler as unknown as (
      err: unknown,
      req: Request,
      res: Response,
      next: NextFunction,
    ) => void,
  );

  return app;
}
