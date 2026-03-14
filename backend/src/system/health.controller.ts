import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { logger } from "../utils/logger/logger";

export const healthController = {
  async check(_req: Request, res: Response): Promise<void> {
    let dbStatus: "ok" | "error" = "ok";
    let dbLatencyMs = 0;

    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch (err) {
      dbStatus = "error";
      logger.error({ err }, "Health check: DB error");
    }

    const healthy = dbStatus === "ok";

    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      services: {
        database: { status: dbStatus, latencyMs: dbLatencyMs },
      },
    });
  },
};
