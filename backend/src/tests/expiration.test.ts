/**
 * expiration.test.ts — Run: ts-node src/tests/expiration.test.ts
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { authService } from "../modules/auth/auth.service";
import { inventoryRepository } from "../modules/inventory/inventory.repository";
import { productRepository } from "../modules/product/product.repository";
import { reservationRepository } from "../modules/reservation/reservation.repository";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function createProduct(stock: number) {
  return prisma.product.create({
    data: {
      name: `Expiry Test ${Date.now()}`,
      price: 49.99,
      totalStock: stock,
      availableStock: stock,
    },
  });
}

async function runExpiryCycle(): Promise<number> {
  const expired = await reservationRepository.findExpired();
  let count = 0;
  for (const reservation of expired) {
    await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const locked = await reservationRepository.findByIdForUpdate(
          reservation.id,
          tx,
        );
        if (
          !locked ||
          locked.status !== "PENDING" ||
          locked.expiresAt > new Date()
        )
          return;
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "EXPIRED" },
        });
        await productRepository.updateAvailableStock(
          locked.productId,
          locked.quantity,
          tx,
        );
        await inventoryRepository.log(
          {
            productId: locked.productId,
            change: locked.quantity,
            reason: "EXPIRATION",
            referenceId: reservation.id,
          },
          tx,
        );
      },
      { isolationLevel: "Serializable", maxWait: 3000, timeout: 8000 },
    );
    count++;
  }
  return count;
}

async function testExpirationRestoresStock() {
  console.log("\n[1] Expiration restores stock");
  const product = await createProduct(5);
  const user = await authService.register(
    `expiry_${Date.now()}@example.com`,
    "Password123!",
  );

  const past = new Date(Date.now() - 60_000);
  const res = await prisma.$transaction((tx: Prisma.TransactionClient) =>
    reservationRepository.create(
      {
        userId: user.userId,
        productId: product.id,
        quantity: 3,
        expiresAt: past,
      },
      tx,
    ),
  );

  await prisma.product.update({
    where: { id: product.id },
    data: { availableStock: { decrement: 3 } },
  });

  const before = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
  });
  assert(before.availableStock === 2, "Stock reduced before expiry run");

  await runExpiryCycle();

  const after = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
  });
  assert(after.availableStock === 5, "Stock fully restored after expiry");

  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id: res.id },
  });
  assert(reservation.status === "EXPIRED", "Reservation marked EXPIRED");

  const log = await prisma.inventoryLog.findFirst({
    where: { referenceId: res.id, reason: "EXPIRATION" },
  });
  assert(!!log, "Inventory log created");
  assert(log!.change === 3, "Correct quantity logged");
}

async function testNoDoubleProcessing() {
  console.log("\n[2] No double processing");
  const product = await createProduct(5);
  const user = await authService.register(
    `expiry2_${Date.now()}@example.com`,
    "Password123!",
  );

  const past = new Date(Date.now() - 60_000);
  const reservation = await prisma.$transaction(
    (tx: Prisma.TransactionClient) =>
      reservationRepository.create(
        {
          userId: user.userId,
          productId: product.id,
          quantity: 1,
          expiresAt: past,
        },
        tx,
      ),
  );
  await prisma.product.update({
    where: { id: product.id },
    data: { availableStock: { decrement: 1 } },
  });

  await runExpiryCycle();
  await runExpiryCycle();

  const after = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
  });
  assert(after.availableStock === 5, "Stock restored exactly once");

  const logs = await prisma.inventoryLog.findMany({
    where: { referenceId: reservation.id, reason: "EXPIRATION" },
  });
  assert(logs.length === 1, "Only 1 EXPIRATION log entry");
}

async function runAll() {
  console.log("=== Expiration Tests ===");
  let passed = 0;
  let failed = 0;
  for (const test of [testExpirationRestoresStock, testNoDoubleProcessing]) {
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
