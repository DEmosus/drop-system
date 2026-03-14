// ── Product ───────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  totalStock: number;
  availableStock: number;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  userId: string;
  email: string;
  token: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  userId: string;
  email: string;
  token: string;
}

// ── Reservation ───────────────────────────────────────────────────────────────

export interface ReservePayload {
  productId: string;
  quantity: number;
}

export interface ReserveResponse {
  reservationId: string;
  expiresAt: string; // ISO string
  expiresInSeconds: number;
}

export interface CheckoutPayload {
  reservationId: string;
}

export interface CheckoutResponse {
  orderId: string;
}

// ── Reservation state machine ─────────────────────────────────────────────────

export type ReservationState =
  | { type: "idle" }
  | { type: "reserving" }
  | { type: "active"; reservationId: string; expiresAt: Date }
  | { type: "checking-out" }
  | { type: "complete"; orderId: string }
  | { type: "expired" }
  | { type: "cancelled" }
  | { type: "error"; message: string };

// ── Timer ─────────────────────────────────────────────────────────────────────

export interface TimerState {
  secondsLeft: number;
  formatted: string; // "04:32"
  isExpired: boolean;
  progress: number; // 0–1 for SVG ring
}

// ── API response envelope ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ApiError {
  success: false;
  code: string;
  message: string;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
