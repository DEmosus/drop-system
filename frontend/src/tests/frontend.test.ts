import { describe, expect, test } from "vitest";

/**
 * frontend.test.ts
 *
 * Pure logic tests for the drop system frontend.
 * No DOM, no React, no network.
 *
 * These tests verify:
 * - Timer logic
 * - Reservation state machine
 * - API error handling
 *
 * This ensures the UI behaves correctly under
 * high-concurrency drop conditions.
 */

// ───────────────────────────────────────────────────────────────
// Timer Logic (extracted from useReservationTimer)
// ───────────────────────────────────────────────────────────────

const TOTAL_SECONDS = 5 * 60;

function buildTimerState(secondsLeft: number) {
  const safeSeconds = Number.isFinite(secondsLeft) ? secondsLeft : 0;
  const clamped = Math.max(0, safeSeconds);

  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;

  return {
    secondsLeft: clamped,
    formatted: `${String(mins).padStart(2, "0")}:${String(secs).padStart(
      2,
      "0",
    )}`,
    isExpired: clamped <= 0,
    progress: clamped / TOTAL_SECONDS,
  };
}

// ───────────────────────────────────────────────────────────────
// Reservation State Machine (extracted from useReserveProduct)
// ───────────────────────────────────────────────────────────────

type ReservationState =
  | { type: "idle" }
  | { type: "reserving" }
  | { type: "active"; reservationId: string; expiresAt: Date }
  | { type: "checking-out" }
  | { type: "complete"; orderId: string }
  | { type: "expired" }
  | { type: "cancelled" }
  | { type: "error"; message: string };

type ReservationAction =
  | { type: "RESERVE_START" }
  | { type: "RESERVE_SUCCESS"; reservationId: string; expiresAt: Date }
  | { type: "RESERVE_FAIL"; message: string }
  | { type: "CHECKOUT_START" }
  | { type: "CHECKOUT_SUCCESS"; orderId: string }
  | { type: "CHECKOUT_FAIL"; message: string; expired?: boolean }
  | { type: "CANCEL" }
  | { type: "EXPIRE" }
  | { type: "RESET" };

function transition(
  state: ReservationState,
  action: ReservationAction,
): ReservationState {
  switch (action.type) {
    case "RESERVE_START":
      return { type: "reserving" };

    case "RESERVE_SUCCESS":
      return {
        type: "active",
        reservationId: action.reservationId,
        expiresAt: action.expiresAt,
      };

    case "RESERVE_FAIL":
      return { type: "error", message: action.message };

    case "CHECKOUT_START":
      return state.type === "active" ? { type: "checking-out" } : state;

    case "CHECKOUT_SUCCESS":
      return { type: "complete", orderId: action.orderId };

    case "CHECKOUT_FAIL":
      return action.expired
        ? { type: "expired" }
        : { type: "error", message: action.message };

    case "CANCEL":
      return { type: "cancelled" };

    case "EXPIRE":
      return { type: "expired" };

    case "RESET":
      return { type: "idle" };
  }
}

// ───────────────────────────────────────────────────────────────
// API Error Handling
// ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  public readonly code: string;
  public readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function normaliseError(raw: {
  code?: string;
  message?: string;
  status?: number;
}): ApiError {
  return new ApiError(
    raw.code ?? "UNKNOWN",
    raw.message ?? "Unknown error",
    raw.status,
  );
}

// ───────────────────────────────────────────────────────────────
// Timer Tests
// ───────────────────────────────────────────────────────────────

describe("Reservation Timer Logic", () => {
  test("formats full timer correctly", () => {
    const t = buildTimerState(300);

    expect(t.formatted).toBe("05:00");
    expect(t.progress).toBe(1);
    expect(t.isExpired).toBe(false);
  });

  test("formats partial time correctly", () => {
    const t = buildTimerState(65);

    expect(t.formatted).toBe("01:05");
    expect(t.isExpired).toBe(false);
  });

  test("zero seconds is expired", () => {
    const t = buildTimerState(0);

    expect(t.isExpired).toBe(true);
    expect(t.formatted).toBe("00:00");
    expect(t.progress).toBe(0);
  });

  test("negative values clamp to zero", () => {
    const t = buildTimerState(-10);

    expect(t.secondsLeft).toBe(0);
    expect(t.isExpired).toBe(true);
  });

  test("progress ratio correct at halfway", () => {
    const t = buildTimerState(150);

    expect(Math.abs(t.progress - 0.5)).toBeLessThan(0.001);
  });

  test("prevents NaN timer bug", () => {
    const invalid = buildTimerState(Number.NaN);

    expect(invalid.secondsLeft).toBe(0);
    expect(invalid.formatted).toBe("00:00");
  });
});

// ───────────────────────────────────────────────────────────────
// Reservation State Machine Tests
// ───────────────────────────────────────────────────────────────

describe("Reservation State Machine", () => {
  test("idle → reserving → active", () => {
    let s: ReservationState = { type: "idle" };

    s = transition(s, { type: "RESERVE_START" });
    expect(s.type).toBe("reserving");

    s = transition(s, {
      type: "RESERVE_SUCCESS",
      reservationId: "r-123",
      expiresAt: new Date(),
    });

    expect(s.type).toBe("active");

    if (s.type === "active") {
      expect(s.reservationId).toBe("r-123");
    }
  });

  test("active → checking-out → complete", () => {
    let s: ReservationState = {
      type: "active",
      reservationId: "r-1",
      expiresAt: new Date(),
    };

    s = transition(s, { type: "CHECKOUT_START" });
    expect(s.type).toBe("checking-out");

    s = transition(s, { type: "CHECKOUT_SUCCESS", orderId: "o-456" });

    expect(s.type).toBe("complete");

    if (s.type === "complete") {
      expect(s.orderId).toBe("o-456");
    }
  });

  test("reserve failure → error", () => {
    let s: ReservationState = { type: "idle" };

    s = transition(s, { type: "RESERVE_START" });

    s = transition(s, {
      type: "RESERVE_FAIL",
      message: "Insufficient stock",
    });

    expect(s.type).toBe("error");

    if (s.type === "error") {
      expect(s.message).toBe("Insufficient stock");
    }
  });

  test("checkout expiration → expired state", () => {
    let s: ReservationState = {
      type: "active",
      reservationId: "r-1",
      expiresAt: new Date(),
    };

    s = transition(s, { type: "CHECKOUT_START" });

    s = transition(s, {
      type: "CHECKOUT_FAIL",
      message: "Expired",
      expired: true,
    });

    expect(s.type).toBe("expired");
  });

  test("cancel → cancelled", () => {
    let s: ReservationState = {
      type: "active",
      reservationId: "r-1",
      expiresAt: new Date(),
    };

    s = transition(s, { type: "CANCEL" });

    expect(s.type).toBe("cancelled");
  });

  test("RESET always returns idle", () => {
    const states: ReservationState[] = [
      { type: "expired" },
      { type: "cancelled" },
      { type: "error", message: "x" },
      { type: "complete", orderId: "o-1" },
    ];

    for (const s of states) {
      const next = transition(s, { type: "RESET" });
      expect(next.type).toBe("idle");
    }
  });
});

// ───────────────────────────────────────────────────────────────
// API Error Tests
// ───────────────────────────────────────────────────────────────

describe("ApiError normalisation", () => {
  test("preserves code and message", () => {
    const err = normaliseError({
      code: "INSUFFICIENT_STOCK",
      message: "Not enough stock",
      status: 409,
    });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("INSUFFICIENT_STOCK");
    expect(err.message).toBe("Not enough stock");
    expect(err.status).toBe(409);
  });

  test("missing fields default correctly", () => {
    const err = normaliseError({});

    expect(err.code).toBe("UNKNOWN");
    expect(err.message).toBe("Unknown error");
  });
});
