import { ReservationStatus } from "@prisma/client";

/**
 * Valid state transitions for a reservation.
 * Enforced at the service layer to prevent invalid status updates.
 */
const VALID_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: ["COMPLETED", "EXPIRED", "CANCELLED"],
  COMPLETED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export function canTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid reservation transition: ${from} → ${to}`);
  }
}
