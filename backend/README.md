# Drop System — Backend

Node.js + TypeScript + Prisma + PostgreSQL API for the limited stock reservation engine.

---

## Stack

| Layer      | Technology                    |
| ---------- | ----------------------------- |
| Runtime    | Node.js 18+                   |
| Language   | TypeScript (strict)           |
| Framework  | Express                       |
| ORM        | Prisma                        |
| Database   | PostgreSQL 14+                |
| Validation | Zod                           |
| Auth       | JWT (jsonwebtoken) + bcryptjs |
| Logging    | Pino                          |
| Scheduling | node-cron                     |
| Testing    | ts-node (custom test runner)  |

---

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma              # Database schema + enums
│   └── seed.ts                    # Demo products + users
│
├── src/
│   ├── config/
│   │   ├── env.ts                 # Zod-validated environment variables
│   │   ├── prisma.ts              # Prisma singleton
│   │   └── constants.ts           # BCRYPT_ROUNDS, etc.
│   │
│   ├── server/
│   │   ├── app.ts                 # Express app, middleware registration
│   │   └── startServer.ts         # HTTP server + worker boot
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts    # register / login / JWT signing
│   │   │   ├── auth.repository.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── auth.types.ts
│   │   │
│   │   ├── product/
│   │   │   ├── product.controller.ts
│   │   │   ├── product.service.ts  # pagination, sorting, filtering
│   │   │   ├── product.repository.ts
│   │   │   ├── product.routes.ts
│   │   │   └── product.types.ts
│   │   │
│   │   ├── reservation/
│   │   │   ├── reservation.controller.ts
│   │   │   ├── reservation.service.ts  # core concurrency logic
│   │   │   ├── reservation.repository.ts
│   │   │   ├── reservation.routes.ts
│   │   │   ├── reservation.types.ts
│   │   │   └── reservation.state.ts
│   │   │
│   │   ├── order/
│   │   │   ├── order.service.ts
│   │   │   ├── order.repository.ts
│   │   │   └── order.types.ts
│   │   │
│   │   └── inventory/
│   │       ├── inventory.service.ts
│   │       ├── inventory.repository.ts
│   │       └── inventory.types.ts
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts       # JWT verification
│   │   ├── validate.middleware.ts   # Zod middleware factory
│   │   ├── rateLimit.middleware.ts  # express-rate-limit config
│   │   ├── requestLogger.middleware.ts
│   │   └── errorHandler.middleware.ts  # centralised error → HTTP response
│   │
│   ├── workers/
│   │   └── reservationExpiration.worker.ts  # cron: expire + restore stock
│   │
│   ├── validators/
│   │   ├── auth.schema.ts
│   │   ├── reservation.schema.ts
│   │   └── product.schema.ts
│   │
│   ├── utils/
│   │   ├── errors/
│   │   │   ├── AppError.ts
│   │   │   ├── ConflictError.ts
│   │   │   ├── ValidationError.ts
│   │   │   └── index.ts            # re-exports all error classes
│   │   ├── logger/
│   │   │   └── logger.ts           # Pino instance
│   │   ├── metrics/
│   │   │   └── metrics.store.ts    # in-memory counters
│   │   └── helpers/
│   │       ├── asyncHandler.ts
│   │       └── pagination.ts
│   │
│   ├── system/
│   │   ├── health.controller.ts
│   │   ├── metrics.controller.ts
│   │   └── system.routes.ts
│   │
│   ├── tests/
│   │   ├── reservation.test.ts     # 6 unit-style scenarios
│   │   ├── concurrency.test.ts     # parallel request simulation
│   │   └── expiration.test.ts      # worker + stock restoration
│   │
│   └── types/
│       └── global.d.ts             # Express Request augmentation
│
├── .env.example
├── package.json
├── tsconfig.json
└── nodemon.json
```

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — DATABASE_URL and JWT_SECRET are required

# 3. Generate Prisma client
npx prisma generate

# 4. Run migrations
npx prisma migrate dev

# 5. Seed demo data
npm run prisma:seed

# 6. Start dev server (nodemon + ts-node)
npm run dev
```

Server starts on `http://localhost:3001`.

---

## Environment Variables

```bash
# ── Required ──────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@localhost:5432/dropsystem
JWT_SECRET=minimum-32-character-secret-key-here

# ── Optional (defaults shown) ─────────────────────────────────
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_WINDOW_MS=60000       # 1 minute window
RATE_LIMIT_MAX=100               # max requests per window
RESERVATION_EXPIRY_MINUTES=5
CRON_INTERVAL_SECONDS=60
```

---

## API Reference

### Auth

```
POST /api/auth/register   { email, password }        → { token, userId, email }
POST /api/auth/login      { email, password }        → { token, userId, email }
```

### Products

```
GET /api/products         ?page&limit&search&inStock&sortBy&sortOrder
GET /api/products/:id
```

### Reservations — Bearer token required

```
POST   /api/reserve              { productId, quantity }  → { reservationId, expiresInSeconds }
POST   /api/checkout             { reservationId }        → { orderId }
DELETE /api/reservations/:id
GET    /api/reservations         ?page
```

### System

```
GET /health    → { status, uptime, timestamp, db }
GET /metrics   → { totalReservations, failedReservations, expiredReservations,
                   cancelledReservations, completedCheckouts }
```

---

## Error Codes

| Code                    | HTTP | When                                                    |
| ----------------------- | ---- | ------------------------------------------------------- |
| `INSUFFICIENT_STOCK`    | 409  | Stock exhausted at reserve time                         |
| `DUPLICATE_RESERVATION` | 409  | User already has a PENDING reservation for this product |
| `CONFLICT`              | 409  | Double checkout attempt                                 |
| `RESERVATION_EXPIRED`   | 410  | Reservation timed out before checkout                   |
| `UNAUTHORIZED`          | 401  | Missing or invalid JWT                                  |
| `VALIDATION_ERROR`      | 400  | Zod schema failure                                      |
| `NOT_FOUND`             | 404  | Product or reservation not found                        |
| `RATE_LIMITED`          | 429  | Too many requests                                       |

---

## Database Schema

```
Product
  id            uuid  PK
  name          String
  description   String?
  price         Decimal
  imageUrl      String?
  totalStock    Int          — never changes after creation
  availableStock Int         — decremented on reserve, incremented on expiry/cancel
  createdAt     DateTime
  updatedAt     DateTime

Reservation
  id            uuid  PK
  userId        uuid  → User
  productId     uuid  → Product
  quantity      Int
  status        PENDING | COMPLETED | EXPIRED | CANCELLED
  expiresAt     DateTime
  createdAt     DateTime
  updatedAt     DateTime

Order
  id            uuid  PK
  userId        uuid  → User
  reservationId uuid  → Reservation  UNIQUE
  productId     uuid  → Product
  quantity      Int
  status        CONFIRMED
  createdAt     DateTime

User
  id            uuid  PK
  email         String  UNIQUE
  passwordHash  String
  createdAt     DateTime

InventoryLog
  id            uuid  PK
  productId     uuid  → Product
  change        Int          — negative = deducted, positive = restored
  reason        RESERVATION | CHECKOUT | EXPIRATION | CANCELLATION
  referenceId   String       — reservationId or orderId
  createdAt     DateTime
```

---

## Concurrency Model

Every reservation runs inside a `SERIALIZABLE` transaction with an explicit row lock:

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

  SELECT * FROM "Product" WHERE id = $1 FOR UPDATE;
  -- ↑ Exclusive lock. All competing transactions block here.

  -- Atomic check + deduct:
  UPDATE "Product" SET availableStock = availableStock - $quantity WHERE id = $1;
  INSERT INTO "Reservation" ...;
  INSERT INTO "InventoryLog" ...;

COMMIT;
```

PostgreSQL returns error `40001` when a transaction cannot be serialized. Prisma surfaces this as `P2034`. The service layer retries up to 3 times with linear backoff before propagating the error to the client:

```typescript
async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isSerializationError(err) && attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 10 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}
```

**Guarantees:**

- Stock never goes negative
- Exactly N reservations succeed for N available units
- No phantom reads or lost updates

---

## Expiration Worker

`src/workers/reservationExpiration.worker.ts` runs every 60 seconds (configurable via `CRON_INTERVAL_SECONDS`) and:

1. Finds all `PENDING` reservations where `expiresAt < NOW()`
2. Marks them `EXPIRED`
3. Restores `availableStock` on the related `Product`
4. Writes an `EXPIRATION` row to `InventoryLog`
5. Increments `metricsStore.expiredReservations`

The worker starts automatically when the server boots. For multi-instance deployments, wrap it with a distributed lock to avoid duplicate expiration.

---

## Tests

Tests use `ts-node` directly — no test framework needed.

```bash
# Reservation logic (6 scenarios)
npm run test

# Concurrency simulation (4 scenarios)
npm run test:concurrency
```

### `reservation.test.ts` covers

| #   | Scenario                         | What it verifies                                             |
| --- | -------------------------------- | ------------------------------------------------------------ |
| 1   | Basic reservation                | Reservation ID returned, expiry in future, stock decremented |
| 2   | Insufficient stock               | `INSUFFICIENT_STOCK` error, stock unchanged                  |
| 3   | Duplicate reservation prevention | `DUPLICATE_RESERVATION` on second attempt                    |
| 4   | Checkout flow                    | Order created, reservation marked COMPLETED                  |
| 5   | Double-checkout prevention       | `CONFLICT` on second checkout of same reservation            |
| 6   | Cancellation + stock restore     | Stock returns to original value                              |

### `concurrency.test.ts` covers

| Scenario                | What it verifies                                         |
| ----------------------- | -------------------------------------------------------- |
| 10 requests → 5 stock   | Exactly 5 succeed, exactly 5 fail                        |
| 20 requests → 1 stock   | Exactly 1 succeeds, 19 fail                              |
| 3 requests → 3 stock    | All 3 succeed (retry handles serialization errors)       |
| Duplicate checkout race | Exactly 1 order created despite 5 simultaneous checkouts |

---

## Scripts

```bash
npm run dev          # nodemon + ts-node dev server
npm run build        # tsc → dist/
npm start            # node dist/server/startServer.js
npm run test         # reservation.test.ts
npm run test:concurrency  # concurrency.test.ts
npm run prisma:seed  # run prisma/seed.ts
```

---

## Deployment (Render)

```
Build command:  npm install && npx prisma generate && npm run build
Start command:  npm start
Health check:   GET /health
```

Set all required environment variables in the Render dashboard. The expiration worker starts automatically as part of the server process — no separate service needed for single-instance deployments.
