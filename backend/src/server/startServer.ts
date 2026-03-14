import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { logger } from "../utils/logger/logger";
import { startExpirationWorker } from "../workers/reservationExpiration.worker";
import { createApp } from "./app";

async function startServer(): Promise<void> {
  // ── Verify DB connection ──────────────────────────────────────────────────
  try {
    await prisma.$connect();
    logger.info("Database connected");
  } catch (err) {
    logger.fatal({ err }, "Failed to connect to database");
    process.exit(1);
  }

  // ── Start expiration worker ───────────────────────────────────────────────
  startExpirationWorker();
  logger.info("Reservation expiration worker started");

  // ── Start HTTP server ─────────────────────────────────────────────────────
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `🚀 Drop System API listening on port ${env.PORT}`,
    );
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutdown signal received");

    server.close(async () => {
      await prisma.$disconnect();
      logger.info("Server closed, DB disconnected");
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception");
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled promise rejection");
    process.exit(1);
  });
}

startServer();
