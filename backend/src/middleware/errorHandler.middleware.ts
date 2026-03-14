import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors/AppError";
import { logger } from "../utils/logger/logger";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId;

  // ── Zod validation errors ─────────────────────────────────────────────────
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      errors: err.flatten().fieldErrors,
      requestId,
    });
    return;
  }

  // ── Known application errors ──────────────────────────────────────────────
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId, path: req.path }, err.message);
    } else {
      logger.warn({ code: err.code, requestId, path: req.path }, err.message);
    }

    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      requestId,
    });
    return;
  }

  // ── Unknown errors ────────────────────────────────────────────────────────
  logger.error({ err, requestId, path: req.path }, "Unhandled error");

  res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    requestId,
  });
}
