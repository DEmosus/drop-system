import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PRODUCTS = [
  {
    name: 'Air Max Phantom "Midnight"',
    description:
      "Ultra-limited collab drop. Hand-stitched midnight leather with reactive sole. Only 50 pairs ever made.",
    price: 380,
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",
    totalStock: 50,
    availableStock: 8,
  },
  {
    name: "Neon Cargo Jacket",
    description:
      "Drop-exclusive utility jacket with hidden LED trim. Waterproof shell, 12 pockets. Limited run of 100.",
    price: 420,
    imageUrl:
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800",
    totalStock: 100,
    availableStock: 17,
  },
  {
    name: "Digital Native Watch",
    description:
      "Mechanical movement meets digital display. Titanium case, sapphire crystal. 30 units worldwide.",
    price: 1200,
    imageUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",
    totalStock: 30,
    availableStock: 30,
  },
  {
    name: "Phantom Hoodie Vol. 3",
    description:
      "Third-gen fleece-lined hoodie in new colourways. Preshrunk heavyweight cotton blend. 200 made.",
    price: 180,
    imageUrl:
      "https://images.unsplash.com/photo-1627137727320-4a7c6782102a?w=800",
    totalStock: 200,
    availableStock: 200,
  },
  {
    name: "Ceramic Pour-Over Set",
    description:
      "Hand-thrown artisan pour-over + 2 cups. Unique ash glaze. No two sets identical. 75 sets only.",
    price: 145,
    imageUrl:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800",
    totalStock: 75,
    availableStock: 6,
  },
];

const DEMO_USERS = [
  { email: "demo@example.com", password: "password123" },
  { email: "alice@example.com", password: "password123" },
  { email: "bob@example.com", password: "password123" },
];

async function seed(): Promise<void> {
  console.log("🌱 Checking database...\n");

  // ── Idempotency guard ──────────────────────────────────────────
  // Safe to run on every deploy — only seeds if the database is empty.
  const existingCount = await prisma.product.count();

  if (existingCount > 0) {
    console.log(
      `  ℹ️  Database already has ${existingCount} product(s) — skipping seed.`,
    );
    return;
  }

  console.log("  No products found — seeding demo data...\n");

  // ── Products ───────────────────────────────────────────────────
  for (const product of PRODUCTS) {
    await prisma.product.create({ data: product });
  }
  console.log(`  ✓ Created ${PRODUCTS.length} products`);

  // ── Users ──────────────────────────────────────────────────────
  for (const { email, password } of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { email, passwordHash } });
  }
  console.log(`  ✓ Created ${DEMO_USERS.length} users`);
  console.log("    demo@example.com  / password123");
  console.log("    alice@example.com / password123");
  console.log("    bob@example.com   / password123");

  console.log("\n✅ Seed complete");
}

seed()
  .catch((err: unknown) => {
    console.error("❌ Seed failed:", err);
    // Use a setTimeout so the finally block can run $disconnect first
    setTimeout(() => {
      throw err;
    }, 0);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
