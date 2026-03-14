# Drop System — Limited Stock Reservation Engine

A production-grade limited stock drop system built to handle 100+ concurrent users competing for the same item simultaneously. Prevents overselling through serializable database transactions, row-level locking, and automatic reservation expiry.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│                                                                 │
│   React + TypeScript                                            │
│   ├── useProducts()        — 5s polling, product list           │
│   ├── useProduct(id)       — 5s polling, single product         │
│   ├── useReserveProduct()  — state machine (idle → active → …)  │
│   └── useReservationTimer()— countdown from expiresAt           │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP/REST  (Axios, JWT Bearer)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                                │
│                                                                 │
│   Express + TypeScript                                          │
│   ├── Rate Limiting      (express-rate-limit, 100/min global)   │
│   ├── CORS               (configured origin)                    │
│   ├── JWT Auth Middleware (all /reserve, /checkout, /cancel)    │
│   ├── Zod Validation     (all request bodies + query params)    │
│   ├── Request Logger     (Pino, structured JSON)                │
│   └── Error Handler      (centralised, typed error codes)       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                              │
│                                                                 │
│   ├── auth.service.ts         — register / login / JWT          │
│   ├── reservation.service.ts  — reserve / checkout / cancel     │
│   │   └── withSerializableRetry()  — P2034 retry (3 attempts)   │
│   └── reservationExpiration.worker.ts  — cron, restores stock   │
└────────────────────┬────────────────────────────────────────────┘
                     │ Prisma ORM
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                              │
│                                                                 │
│   PostgreSQL                                                    │
│   ├── SERIALIZABLE isolation level                              │
│   ├── SELECT … FOR UPDATE  (row-level lock on Product)          │
│   └── Atomic check + deduct in single transaction               │
└─────────────────────────────────────────────────────────────────┘
```

---

## How Race Conditions Are Handled

This is the core problem: 100 users click "Reserve" simultaneously on a product with 5 units left. Without protection, all 100 reads see `availableStock = 5`, all 100 try to deduct, and you end up with -95 stock.

### The Solution: Serializable Transactions + Row-Level Locking

Every reservation runs inside a `SERIALIZABLE` transaction with an explicit `SELECT … FOR UPDATE`:

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

  -- Acquires an exclusive row lock on this product.
  -- Any concurrent transaction trying the same will BLOCK here.
  SELECT * FROM "Product" WHERE id = $1 FOR UPDATE;

  -- Only one transaction holds the lock at a time.
  -- Stock check is atomic with the update below.
  IF availableStock >= quantity THEN
    UPDATE "Product"
      SET availableStock = availableStock - quantity
      WHERE id = $1;

    INSERT INTO "Reservation" (...) VALUES (...);
    INSERT INTO "InventoryLog" (...) VALUES (...);
  ELSE
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

COMMIT;
```

**Why SERIALIZABLE instead of just `FOR UPDATE`?**

`FOR UPDATE` alone prevents lost updates but not phantom reads under `READ COMMITTED`. `SERIALIZABLE` guarantees the transaction sees a consistent snapshot — no other committed write can affect the outcome mid-transaction. This is the strongest isolation level and the only one that fully prevents all anomalies.

**What happens to the other 95 requests?**

- They block on `SELECT … FOR UPDATE` until the first transaction commits.
- PostgreSQL's MVCC then detects the stock changed. Transactions that cannot be safely serialized receive error code `40001` (`could not serialize access due to concurrent update`).
- The service layer catches `P2034` (Prisma's mapping of `40001`) and retries up to 3 times with a short backoff.
- After retries, if stock is genuinely exhausted, they receive `INSUFFICIENT_STOCK`.

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

**Result:** Stock never goes below zero. Exactly N reservations succeed for N units of stock.

---

## Schema Design Decisions

```
Product          Reservation              Order
───────          ───────────              ─────
id (uuid)        id (uuid)                id (uuid)
name             userId  ──→ User         userId  ──→ User
description      productId ──→ Product    reservationId ──→ Reservation (UNIQUE)
price (Decimal)  quantity                 productId ──→ Product
imageUrl         status (enum)            quantity
totalStock       expiresAt                status (enum)
availableStock   createdAt                createdAt
createdAt        updatedAt
updatedAt

User             InventoryLog
────             ────────────
id (uuid)        id (uuid)
email (UNIQUE)   productId ──→ Product
passwordHash     change (Int, + or -)
createdAt        reason (enum)
                 referenceId
                 createdAt
```

### Why `availableStock` is denormalised onto `Product`

An alternative is to compute available stock from `InventoryLog` on every read. That is correct but unacceptable at scale — a `SUM` across a log table with millions of rows is a full scan. Storing `availableStock` as a single integer on `Product` makes stock reads `O(1)` and allows the `FOR UPDATE` lock to be on a single, predictable row. The `InventoryLog` is the source of truth for auditing; `availableStock` is the fast operational view.

### Why two stock fields (`totalStock` + `availableStock`)

- `totalStock` never changes. It is the committed production run (e.g. "50 pairs made").
- `availableStock` fluctuates: decremented on reserve, incremented on expiry/cancellation, stays decremented on checkout.
- Together they power the stock indicator percentage bar and sold-out detection without any joins.

### Why `Reservation` has its own status enum

`PENDING → COMPLETED | EXPIRED | CANCELLED` is a proper state machine. Encoding it as an enum in the database (not a boolean `isActive`) makes invalid transitions impossible at the schema level and makes queries self-documenting.

### Why `Order.reservationId` has a UNIQUE constraint

This is the last line of defence against duplicate checkouts. Even if two concurrent checkout requests race past application-level guards, the database unique constraint ensures only one `Order` row can exist per reservation. The second insert gets a `P2002` unique constraint error, which the service maps to a `CONFLICT` response.

### Why UUID primary keys instead of auto-increment integers

UUIDs are safe to expose in URLs and API responses — they reveal no information about record count or creation order. Auto-increment integers leak business metrics (e.g. `/reservations/1042` tells a competitor how many reservations you have).

### Why `InventoryLog`

Every stock change — reservation, checkout, expiration, cancellation — writes an immutable audit row. This makes it possible to reconstruct the exact stock level at any point in time, debug discrepancies, and comply with audit requirements. It costs one extra write per operation, which is acceptable.

---

## Trade-offs

| Decision                             | Benefit                                       | Cost                                                                                              |
| ------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| SERIALIZABLE isolation               | Zero race conditions                          | Higher lock contention; lower throughput than READ COMMITTED                                      |
| Retry on P2034                       | Serialization errors are transparent to users | Up to 3× DB round-trips on hot contention                                                         |
| In-process cron expiration           | No external infrastructure                    | Expiry doesn't run if the server is down; duplicate expiry possible with multiple instances       |
| 5-second polling (not WebSocket/SSE) | Simple; no stateful server connections        | Stock updates lag up to 5s; 20 req/min per client at scale                                        |
| `availableStock` denormalisation     | O(1) stock reads                              | `availableStock` and `InventoryLog` can theoretically diverge (mitigated by transactional writes) |
| bcryptjs cost factor 12              | Secure password hashing                       | ~300ms per hash; limits auth throughput                                                           |
| JWT (no refresh tokens)              | Stateless; simple                             | 24h tokens can't be instantly revoked; logging out is client-side only                            |

---

## What Would Break at 10,000 Concurrent Users

### 1. Single PostgreSQL instance becomes the bottleneck

All 10,000 requests queue on `SELECT … FOR UPDATE` for the same product row. PostgreSQL can handle this, but lock wait times grow linearly. At extreme concurrency you'd see connection pool exhaustion (`PrismaClientKnownRequestError: connection pool timeout`).

**Fix:** Prisma's connection pool default is 10. Increase `connection_limit` in `DATABASE_URL`. Consider PgBouncer in transaction pooling mode to multiplex thousands of app connections onto a smaller pool of DB connections.

### 2. The in-process cron stops working correctly under multiple instances

If you run 3 backend replicas (e.g. on Render's auto-scaling), each runs its own expiration cron. All three will query and expire the same reservations, causing redundant stock restorations.

**Fix:** Move expiration to a dedicated singleton service, a Render Cron Job, or use a distributed lock (e.g. Redis `SET NX` with TTL) so only one instance runs the job per interval.

### 3. 5-second polling at 10k users = 2,000 requests/second to `/api/products`

Each user polls every 5 seconds. At 10,000 users that is 2,000 requests/second — far beyond what a single Node.js instance handles.

**Fix:** Add a CDN or Redis cache in front of the products list endpoint with a 3–5 second TTL. The cache absorbs the read load; writes (stock changes) invalidate the cache. Alternatively, switch to Server-Sent Events so the server pushes stock updates instead of clients polling.

### 4. Rate limiting is per-instance, not distributed

`express-rate-limit` uses in-memory counters. With 3 replicas, a user can make 3× the intended limit by routing requests to different instances.

**Fix:** Swap the rate limit store to Redis (`rate-limit-redis`). All instances share one counter.

### 5. bcrypt at 10k concurrent logins

bcrypt cost factor 12 uses ~300ms of CPU per hash. 10,000 concurrent logins would peg all CPU cores.

**Fix:** Move auth to a separate service or use Argon2id (faster at equivalent security). Consider horizontal scaling of the auth service independently from the reservation service.

---

## How to Scale It

### Short-term (1k–10k users)

```
Client → CDN (Cloudflare) → Load Balancer
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
               API Instance   API Instance  API Instance
                    │             │             │
                    └─────────────┼─────────────┘
                                  │
                          PgBouncer (connection pool)
                                  │
                          PostgreSQL Primary
                                  │
                          PostgreSQL Replica (reads)
                                  │
                              Redis
                    (rate limiting + product cache + distributed lock)
```

**Changes needed:**

- Redis for rate limiting, session cache, distributed expiry lock.
- PgBouncer for connection multiplexing.
- CDN caching for `GET /api/products` (3s TTL).
- Horizontal scaling of API instances behind a load balancer.

### Medium-term (10k–100k users)

- Replace polling with Server-Sent Events or WebSockets for real-time stock updates
- Move expiration to a dedicated worker service (Render background worker or BullMQ queue)
- Add a read replica; route all `GET` endpoints there
- Queue reservation requests with BullMQ + Redis: requests enter a queue, a worker processes them sequentially per product — eliminates all serialization errors without retries

### Long-term (100k+ users / multi-region)

- Shard by product ID: each product's reservation queue runs on a dedicated partition
- Consider CockroachDB or Spanner for globally distributed SERIALIZABLE transactions
- Implement CQRS: separate write path (reservations) from read path (stock display)
- Use a message broker (Kafka) to fan out stock change events to all regions

---

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm

### Backend

```bash
cd backend

npm install

cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET

npx prisma generate
npx prisma migrate dev
npm run prisma:seed

npm run dev
# Server starts on http://localhost:3001
```

### Frontend

```bash
cd frontend

npm install

# Create .env
echo "VITE_API_URL=http://localhost:3001" > .env

npm run dev
# App starts on http://localhost:5173
```

---

## API Reference

### Authentication

```
POST /api/auth/register    { email, password }  →  { token, userId, email }
POST /api/auth/login       { email, password }  →  { token, userId, email }
```

### Products

```
GET /api/products?page=1&limit=20&search=&inStock=true&sortBy=price&sortOrder=asc
GET /api/products/:id
```

### Reservations — JWT required

```
POST   /api/reserve              { productId, quantity }  →  { reservationId, expiresInSeconds }
POST   /api/checkout             { reservationId }        →  { orderId }
DELETE /api/reservations/:id
GET    /api/reservations?page=1
```

### System

```
GET /health    →  { status, uptime, timestamp }
GET /metrics   →  { totalReservations, failedReservations, expiredReservations, ... }
```

---

## Error Codes

| Code                    | HTTP | When                                                    |
| ----------------------- | ---- | ------------------------------------------------------- |
| `INSUFFICIENT_STOCK`    | 409  | Stock exhausted at reservation time                     |
| `DUPLICATE_RESERVATION` | 409  | User already has a PENDING reservation for this product |
| `CONFLICT`              | 409  | Double checkout attempt                                 |
| `RESERVATION_EXPIRED`   | 410  | Reservation timed out before checkout                   |
| `UNAUTHORIZED`          | 401  | Missing or invalid JWT                                  |
| `VALIDATION_ERROR`      | 400  | Zod schema failure                                      |
| `NOT_FOUND`             | 404  | Product or reservation not found                        |
| `RATE_LIMITED`          | 429  | Too many requests                                       |

---

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/dropsystem
JWT_SECRET=minimum-32-character-secret-key-here

# Optional (defaults shown)
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
RESERVATION_EXPIRY_MINUTES=5
CRON_INTERVAL_SECONDS=60
```

---

## Tests

### Backend (requires live database)

```bash
cd backend
npm run test            # Reservation logic: 6 scenarios
npm run test:concurrency  # Concurrency: 10 parallel → 5 stock, etc.
```

Scenarios covered:

- Basic reservation + stock deduction
- Insufficient stock rejection
- Duplicate reservation prevention
- Full checkout flow
- Double-checkout prevention (unique constraint)
- Cancellation + stock restoration
- 10 concurrent requests → exactly 5 succeed (5 stock)
- 20 concurrent requests → exactly 1 succeeds (1 stock)
- 3 concurrent requests → exactly 3 succeed (3 stock, with retry)
- Duplicate concurrent checkout prevention

### Frontend (pure logic, no DB)

```bash
cd frontend
npm run test
```

Scenarios covered:

- Timer formatting (00:00 → 05:00)
- Expiry detection from ISO timestamp
- Progress ring calculation
- API error normalisation (timeout, network, 4xx, 5xx)
- State machine valid transitions
- Duplicate reservation prevention at UI layer

---

## Security

- **JWT** on all mutation endpoints; tokens expire in 24h
- **Rate limiting**: 100 req/min global; 10 req/min on `/api/reserve`
- **CORS**: restricted to `CORS_ORIGIN` env variable
- **Zod validation**: all inputs validated before reaching service layer
- **bcrypt cost 12**: password hashing with salt rounds
- **No hardcoded secrets**: all configuration via environment variables
- **Unique constraint** on `Order.reservationId`: prevents double-order at DB level
- **Row-level locking**: prevents concurrent stock manipulation

---

## Deployment (Render)

### Backend Web Service

```
Build command:  npm install && npx prisma generate && npm run build
Start command:  npm start
```

### Frontend (Vercel)

```
Build command:  npm run build
Output:         dist/
Env var:        VITE_API_URL=https://your-backend.onrender.com
```

> The expiration worker runs automatically inside the web server via `node-cron`. No separate cron service is required for the basic deployment. For multi-instance deployments, move it to a dedicated Render background worker with a Redis distributed lock.

---
