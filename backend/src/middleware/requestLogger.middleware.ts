import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger/logger";
import { metricsStore } from "../utils/metrics/metrics.store";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = uuidv4();
  const startTime = Date.now();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  metricsStore.incrementRoute(`${req.method} ${req.path}`);

  res.on("finish", () => {
    const latencyMs = Date.now() - startTime;
    const logFn = res.statusCode >= 500 ? logger.error : logger.info;

    logFn.call(
      logger,
      {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        latencyMs,
        userId: req.user?.userId,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      },
      "HTTP request",
    );
  });

  next();
}
