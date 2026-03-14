import { defineConfig } from "@prisma/config";

export default defineConfig({
  datasource: {
    // database connection string
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    // seed script
    seed: "ts-node ./prisma/seed.ts",
  },
});
