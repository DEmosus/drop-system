// frontend/src/hooks/useReservationTimer.ts
import { useEffect, useRef, useState } from "react";
import type { TimerState } from "../types";

const TOTAL_SECONDS = 5 * 60; // 5 minutes — must match backend RESERVATION_EXPIRY_MINUTES

function buildTimerState(secondsLeft: number): TimerState {
  const clamped = Math.max(0, secondsLeft);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return {
    secondsLeft: clamped,
    formatted: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
    isExpired: clamped <= 0,
    progress: clamped / TOTAL_SECONDS, // 1 → full ring, 0 → empty
  };
}

const IDLE: TimerState = {
  secondsLeft: TOTAL_SECONDS,
  formatted: "05:00",
  isExpired: false,
  progress: 1,
};

export function useReservationTimer(expiresAt: Date | null): TimerState {
  const [timerState, setTimerState] = useState<TimerState>(IDLE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      // Defer state update to avoid cascading render warning
      queueMicrotask(() => setTimerState(IDLE));
      return;
    }

    function tick() {
      if (!expiresAt) return;

      const secondsLeft = Math.round((expiresAt.getTime() - Date.now()) / 1000);
      const next = buildTimerState(secondsLeft);
      setTimerState(next);

      if (next.isExpired && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    tick(); // run immediately so there's no 1-second delay on first render
    intervalRef.current = setInterval(tick, 1_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [expiresAt]);

  return timerState;
}
