import { Request, Response } from "express";
import { metricsStore } from "../utils/metrics/metrics.store";

export const metricsController = {
  get(_req: Request, res: Response): void {
    const snapshot = metricsStore.snapshot();

    res.status(200).json({
      success: true,
      data: {
        ...snapshot,
        memoryMB: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
        nodeVersion: process.version,
        pid: process.pid,
      },
    });
  },
};
