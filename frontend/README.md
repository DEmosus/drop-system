# Drop System — Frontend

React + TypeScript frontend for the limited stock reservation engine. Displays live stock, handles the full reservation flow, and degrades gracefully under network failures and race conditions.

---

## Stack

| Layer       | Technology                                  |
| ----------- | ------------------------------------------- |
| Framework   | React 18                                    |
| Language    | TypeScript (strict, no `any`)               |
| Build tool  | Vite                                        |
| HTTP client | Axios                                       |
| Styling     | CSS Modules (per-component `.css` files)    |
| Fonts       | Syne (display) + JetBrains Mono (data/code) |
| Testing     | ts-node (custom test runner, no DOM)        |

---

## Project Structure

```
frontend/src/
│
├── api/
│   └── index.ts               # Typed Axios client + ApiError class
│                              # authApi, productApi, reservationApi
│
├── context/
│   └── AuthContext.tsx         # AuthProvider, useAuth hook
│                              # JWT stored in localStorage
│
├── hooks/
│   ├── useProduct.ts           # Fetches + polls single product every 5s
│   ├── useProducts.ts          # Fetches + polls product list every 5s
│   ├── useReserveProduct.ts    # State machine: idle→reserving→active→…
│   └── useReservationTimer.ts  # Countdown from expiresAt, 1s interval
│
├── components/
│   ├── AuthModal.tsx + .css    # Login / register modal
│   ├── CountdownTimer.tsx + .css  # SVG ring + formatted time
│   ├── ReserveButton.tsx + .css   # Renders correct button per state
│   └── StockIndicator.tsx + .css  # Progress bar + low-stock warning
│
├── pages/
│   ├── DropPage.tsx            # Main page — list view + detail view
│   └── DropPage.css
│
├── tests/
│   └── frontend.test.ts        # Pure-logic tests (no DOM, no DB)
│
├── types/
│   └── index.ts                # All shared TypeScript types
│
├── App.tsx                     # AuthProvider wrapper
├── main.tsx                    # React root
└── index.css                   # Global design tokens + reset
```

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
echo "VITE_API_URL=http://localhost:3001" > .env

# 3. Start dev server
npm run dev
```

App starts on `http://localhost:5173`. Requires the backend running on port 3001 (or whichever `VITE_API_URL` points to).

---

## Environment Variables

```bash
VITE_API_URL=http://localhost:3001
# Points to the backend. No trailing slash. No /api suffix — the api layer adds that.
```

---

## Architecture

### API Layer (`src/api/index.ts`)

Single Axios instance with base URL from `VITE_API_URL`. A request interceptor attaches the JWT from `localStorage` to every request. All errors are normalised into `ApiError` instances with a `code` string matching backend error codes (`INSUFFICIENT_STOCK`, `UNAUTHORIZED`, etc.).

```typescript
export class ApiError extends Error {
  code: string; // e.g. "INSUFFICIENT_STOCK"
  status?: number; // HTTP status
}
```

Three API modules are exported: `authApi`, `productApi`, `reservationApi`.

### Auth (`src/context/AuthContext.tsx`)

`AuthProvider` wraps the entire app. State is `{ user: AuthUser | null }`. On login/register the JWT and user object are written to `localStorage` so sessions survive page refresh. `logout()` clears both.

```typescript
const { isAuthenticated, login, register, logout } = useAuth();
```

### Hooks

#### `useProduct(productId)` / `useProducts()`

Both poll the API every 5 seconds using `setInterval`. The interval is cleared on unmount. A `mountedRef` guard prevents state updates after unmount. Initial fetch shows a loading state; subsequent polls are silent (no spinner flash).

#### `useReserveProduct()`

Implements a state machine:

```
idle
 └─ reserve() ──→ reserving
                    ├─ success ──→ active  { reservationId, expiresAt }
                    └─ error   ──→ error   { message }

active
 ├─ checkout() ──→ checking-out
 │                   ├─ success ──→ complete { orderId }
 │                   └─ error   ──→ error | expired
 └─ cancel()   ──→ cancelled

active (timer fires) ──→ expired  (via reset() called from DropPage)

error | expired | cancelled
 └─ reset() ──→ idle
```

All transitions are explicit. There is no way to reach `checking-out` without first being in `active`. The `cancel()` call is best-effort — if the server call fails, the client still transitions to `cancelled` and the expiration worker will clean up the server-side reservation.

#### `useReservationTimer(expiresAt)`

Takes `expiresAt: Date | null`. When non-null, starts a 1-second interval calculating `secondsLeft = Math.round((expiresAt - now) / 1000)`. Returns `{ secondsLeft, formatted, isExpired, progress }`. When `expiresAt` becomes null (reservation cleared) the timer resets to the idle state.

`TOTAL_SECONDS = 300` — must match `RESERVATION_EXPIRY_MINUTES=5` in the backend `.env`.

---

## Component Reference

### `<StockIndicator available total />`

Displays a labelled progress bar. Colour changes based on remaining percentage:

| Remaining    | Colour                 |
| ------------ | ---------------------- |
| > 30%        | Cyan (`--accent-cyan`) |
| 10–30%       | Amber (`#f5a623`)      |
| < 10%        | Orange (`--warning`)   |
| 0 (sold out) | Red (`--error`)        |

### `<CountdownTimer formatted secondsLeft isExpired />`

SVG ring that drains from full to empty over 5 minutes. Turns amber and pulses when `secondsLeft <= 60`. Shows an expired message when `isExpired`.

### `<ReserveButton state soldOut isAuthenticated on* />`

Renders a different button (or message) for every reservation state. Never shows a reserve button to unauthenticated users — shows "Sign in to reserve" instead.

### `<AuthModal onClose />`

Login/register modal with tab switcher. Displays `ApiError.message` on failure. Closes automatically on successful auth.

---

## Page Flow

`DropPage` has two views toggled by `selectedProductId`:

**List view** (`selectedProductId === null`)

- Fetches all products via `useProducts()` (5s polling)
- Renders a responsive card grid
- Cards show sold-out overlay at 0 stock; low-stock badge at ≤ 20% remaining
- Hovering a non-sold-out card highlights it; clicking sets `selectedProductId`

**Detail view** (`selectedProductId` is set)

- Fetches the single product via `useProduct(id)` (5s polling)
- Full reservation flow: reserve → countdown → checkout or cancel
- "← All Drops" button and clicking the logo return to list view

---

## Design System

All design tokens live in `src/index.css` as CSS custom properties:

```css
--bg-primary / --bg-secondary / --bg-tertiary / --bg-hover
--text-primary / --text-secondary / --text-muted
--accent-pink / --accent-cyan
--error / --warning
--border / --border-pink / --border-cyan
--font-display   /* Syne */
--font-mono      /* JetBrains Mono */
--space-1 … --space-12
--radius-sm / --radius-md / --radius-lg / --radius-xl / --radius-pill
--transition-fast / --transition-base / --transition-slow
--shadow-sm / --shadow-md / --shadow-lg / --shadow-pink / --shadow-cyan
```

Component CSS files use only these variables — no hardcoded colours or pixel values outside of `index.css`.

---

## Tests

```bash
npx ts-node src/tests/frontend.test.ts
```

Tests are pure TypeScript — no DOM, no browser, no test framework. They import the hook logic and utility functions directly and assert outputs.

| Scenario                    | What it tests                                                       |
| --------------------------- | ------------------------------------------------------------------- |
| Timer formatting            | `00:00` → `05:00` across boundary values                            |
| Expiry detection            | `isExpired` becomes true when `secondsLeft <= 0`                    |
| Progress calculation        | `progress` maps correctly from 1.0 → 0.0                            |
| API error normalisation     | `ApiError` constructed correctly from Axios 4xx/5xx/timeout/network |
| State machine transitions   | All valid transitions produce correct next states                   |
| Duplicate reservation guard | `useReserveProduct` rejects a second reserve when already active    |

---

## Edge Cases Handled

| Scenario                              | Handling                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Reservation fails (race condition)    | State transitions to `error` with the backend's message (e.g. "Insufficient stock")            |
| Stock hits zero while user is on page | 5s poll updates `availableStock`; button switches to "SOLD OUT" disabled state                 |
| Network failure on reserve            | Axios timeout → `ApiError` with code `NETWORK_ERROR`; user sees error message + dismiss button |
| API timeout                           | Axios `timeout: 10000`; treated as network error                                               |
| User navigates away mid-reservation   | Timer interval and polling interval are both cleared on unmount                                |
| Cancel fails on server                | Client-side state still transitions to `cancelled`; server cleans up via expiration worker     |
| Page refresh with active JWT          | `loadStoredUser()` reads from `localStorage`; session restored instantly                       |
| JWT expires on server                 | Next API call returns 401 → `ApiError` with `UNAUTHORIZED`; user is prompted to sign in again  |

---

## Scripts

```bash
npm run dev      # Vite dev server with HMR
npm run build    # TypeScript check + Vite production build → dist/
npm run preview  # Serve the dist/ build locally
npm run test     # Run frontend.test.ts
```

---

## Deployment (Vercel)

```
Framework preset:  Vite
Build command:     npm run build
Output directory:  dist
Environment var:   VITE_API_URL=https://your-backend.onrender.com
```

No server-side rendering. The build output is a static SPA.
