/**

* concurrency.test.ts
* Verifies that concurrent reservation requests never oversell.
* Run: ts-node src/tests/concurrency.test.ts
  */

import { randomUUID } from "crypto";
import { prisma } from "../config/prisma";
import { authService } from "../modules/auth/auth.service";
import { reservationService } from "../modules/reservation/reservation.service";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function createTestProduct(stock: number) {
  return prisma.product.create({
    data: {
      name: `Concurrency Test ${Date.now()}`,
      price: 199.99,
      totalStock: stock,
      availableStock: stock,
    },
  });
}

/**

* Fires N concurrent reserve requests for a product with `stock` units.
* Exactly `stock` should succeed; the rest should fail.
  */
async function testConcurrentReservations(stock: number, concurrent: number) {
  console.log(`\n[Concurrency] ${concurrent} requests → ${stock} units`);

  const product = await createTestProduct(stock);

  const users = await Promise.all(
    Array.from({ length: concurrent }, (_, i) =>
      authService.register(
        `concurrency_${Date.now()}_${i}_${randomUUID()}@example.com`,
        "Password123!",
      ),
    ),
  );

  const results = await Promise.allSettled(
    users.map((u) => reservationService.reserve(u.userId, product.id, 1)),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  const stockErrors = results.filter(
    (r) =>
      r.status === "rejected" &&
      ["INSUFFICIENT_STOCK", "SERIALIZATION_CONFLICT"].includes(
        (r.reason as { code?: string })?.code ?? "",
      ),
  ).length;

  const updatedProduct = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
  });

  console.log(
    `  succeeded: ${succeeded}, failed: ${failed}, stock_errors: ${stockErrors}`,
  );

  assert(
    succeeded === stock,
    `Exactly ${stock} reservations succeeded (got ${succeeded})`,
  );

  assert(
    failed === concurrent - stock,
    `Exactly ${concurrent - stock} rejections`,
  );

  assert(succeeded <= stock, `No more than ${stock} reservations succeeded`);

  assert(
    updatedProduct.availableStock === 0,
    "Stock is exactly 0 (never negative)",
  );

  assert(updatedProduct.availableStock >= 0, "Stock never went negative");
}

/**

* Fires multiple checkout requests simultaneously for the same reservation.
* Only one should succeed, others should fail with CONFLICT.
  */
async function testConcurrentCheckouts() {
  console.log("\n[Concurrency] Duplicate checkout prevention");

  const product = await createTestProduct(5);

  const user = await authService.register(
    `checkout_race_${Date.now()}_${randomUUID()}@example.com`,
    "Password123!",
  );

  const { reservationId } = await reservationService.reserve(
    user.userId,
    product.id,
    1,
  );

  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      reservationService.checkout(reservationId, user.userId),
    ),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;

  const conflicts = results.filter(
    (r) =>
      r.status === "rejected" &&
      (r.reason as { code?: string })?.code === "CONFLICT",
  ).length;

  assert(succeeded === 1, `Exactly 1 checkout succeeded (got ${succeeded})`);

  assert(conflicts === 4, `Exactly 4 checkouts failed with CONFLICT`);

  const orderCount = await prisma.order.count({ where: { reservationId } });

  assert(orderCount === 1, "Exactly 1 order created (no duplicates)");
}

async function runAll() {
  console.log("=== Concurrency Tests ===");

  let passed = 0;
  let failed = 0;

  const tests: Array<() => Promise<void>> = [
    () => testConcurrentReservations(5, 10),
    () => testConcurrentReservations(1, 20),
    () => testConcurrentReservations(3, 3),
    testConcurrentCheckouts,
  ];

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (err) {
      failed++;
      console.error(`  ✗ ${(err as Error).message}`);
    }
  }

  await prisma.$disconnect();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  process.exit(failed > 0 ? 1 : 0);
}

runAll();
