/**
 * reservation.test.ts
 * Basic reservation lifecycle tests (requires live DB).
 * Run: ts-node src/tests/reservation.test.ts
 */
import { prisma } from "../config/prisma";
import { authService } from "../modules/auth/auth.service";
import { reservationService } from "../modules/reservation/reservation.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createTestProduct(stock: number) {
  return prisma.product.create({
    data: {
      name: `Test Product ${Date.now()}`,
      price: 99.99,
      totalStock: stock,
      availableStock: stock,
    },
  });
}

async function createTestUser(suffix: string) {
  return authService.register(
    `test_${suffix}_${Date.now()}@example.com`,
    "Password123!",
  );
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  ✓ ${message}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testBasicReservation() {
  console.log("\n[1] Basic reservation");
  const product = await createTestProduct(10);
  const user = await createTestUser("basic");

  const result = await reservationService.reserve(user.userId, product.id, 2);
  assert(!!result.reservationId, "Reservation ID returned");
  assert(result.expiresInSeconds > 0, "Expiry in future");

  const updated = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
  });
  assert(updated.availableStock === 8, "Stock decremented by 2");
}

async function testInsufficientStock() {
  console.log("\n[2] Insufficient stock");
  const product = await createTestProduct(3);
  const user = await createTestUser("insuf");

  let threw = false;
  try {
    await reservationService.reserve(user.userId, product.id, 5);
  } catch (err: unknown) {
    threw = true;
    assert(
      (err as { code?: string }).code === "INSUFFICIENT_STOCK",
      "INSUFFICIENT_STOCK error code",
    );
  }
  assert(threw, "Error thrown");

  const unchanged = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
  });
  assert(unchanged.availableStock === 3, "Stock unchanged");
}

async function testDuplicateReservation() {
  console.log("\n[3] Duplicate reservation prevention");
  const product = await createTestProduct(10);
  const user = await createTestUser("dup");

  await reservationService.reserve(user.userId, product.id, 1);

  let threw = false;
  try {
    await reservationService.reserve(user.userId, product.id, 1);
  } catch (err: unknown) {
    threw = true;
    assert(
      (err as { code?: string }).code === "DUPLICATE_RESERVATION",
      "DUPLICATE_RESERVATION error code",
    );
  }
  assert(threw, "Second reservation rejected");
}

async function testCheckoutFlow() {
  console.log("\n[4] Checkout flow");
  const product = await createTestProduct(5);
  const user = await createTestUser("checkout");

  const { reservationId } = await reservationService.reserve(
    user.userId,
    product.id,
    1,
  );
  const { orderId } = await reservationService.checkout(
    reservationId,
    user.userId,
  );

  assert(!!orderId, "Order created");

  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
  });
  assert(reservation.status === "COMPLETED", "Reservation marked COMPLETED");

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
  });
  assert(order.status === "CONFIRMED", "Order status CONFIRMED");
}

async function testDoubleCheckoutPrevention() {
  console.log("\n[5] Double checkout prevention");
  const product = await createTestProduct(5);
  const user = await createTestUser("dbl");

  const { reservationId } = await reservationService.reserve(
    user.userId,
    product.id,
    1,
  );
  await reservationService.checkout(reservationId, user.userId);

  let threw = false;
  try {
    await reservationService.checkout(reservationId, user.userId);
  } catch (err: unknown) {
    threw = true;
    const code = (err as { code?: string }).code;
    assert(code === "CONFLICT", `CONFLICT code (got: ${code})`);
  }
  assert(threw, "Second checkout rejected");
}

async function testCancellation() {
  console.log("\n[6] Reservation cancellation + stock restore");
  const product = await createTestProduct(5);
  const user = await createTestUser("cancel");

  const { reservationId } = await reservationService.reserve(
    user.userId,
    product.id,
    3,
  );

  const afterReserve = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
  });
  assert(afterReserve.availableStock === 2, "Stock reduced after reserve");

  await reservationService.cancel(reservationId, user.userId);

  const afterCancel = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
  });
  assert(afterCancel.availableStock === 5, "Stock restored after cancel");
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function runAll() {
  console.log("=== Reservation Tests ===");
  const tests = [
    testBasicReservation,
    testInsufficientStock,
    testDuplicateReservation,
    testCheckoutFlow,
    testDoubleCheckoutPrevention,
    testCancellation,
  ];

  let passed = 0;
  let failed = 0;

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
