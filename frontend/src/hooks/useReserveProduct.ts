import { useCallback, useState } from "react";
import { ApiError, reservationApi } from "../api";
import type { ReservationState } from "../types";

interface UseReserveProductResult {
  state: ReservationState;
  reserve: (productId: string, quantity: number) => Promise<void>;
  checkout: () => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
}

export function useReserveProduct(): UseReserveProductResult {
  const [state, setState] = useState<ReservationState>({ type: "idle" });

  // ── Reserve ────────────────────────────────────────────────────────────────

  const reserve = useCallback(async (productId: string, quantity: number) => {
    setState({ type: "reserving" });
    try {
      const result = await reservationApi.reserve({ productId, quantity });
      console.log("Reserve API result:", result);
      setState({
        type: "active",
        reservationId: result.reservationId,
        expiresAt: new Date(result.expiresAt),
      });
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to reserve. Please try again.";
      setState({ type: "error", message });
    }
  }, []);

  // ── Checkout ───────────────────────────────────────────────────────────────

  const checkout = useCallback(async () => {
    if (state.type !== "active") return;
    const { reservationId } = state;

    setState({ type: "checking-out" });
    try {
      const result = await reservationApi.checkout({ reservationId });
      setState({ type: "complete", orderId: result.orderId });
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Checkout failed. Please try again.";
      // If the reservation expired during checkout, reflect that
      if (err instanceof ApiError && err.code === "RESERVATION_EXPIRED") {
        setState({ type: "expired" });
      } else {
        setState({ type: "error", message });
      }
    }
  }, [state]);

  // ── Cancel ─────────────────────────────────────────────────────────────────

  const cancel = useCallback(async () => {
    if (state.type !== "active") return;
    const { reservationId } = state;

    try {
      await reservationApi.cancel(reservationId);
    } catch {
      // Best-effort — if server cancel fails the expiration worker will clean up
    } finally {
      setState({ type: "cancelled" });
    }
  }, [state]);

  // ── Reset ──────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setState({ type: "idle" });
  }, []);

  return { state, reserve, checkout, cancel, reset };
}
