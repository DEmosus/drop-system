import type { ReservationState } from "../types";
import "./ReserveButton.css";

interface Props {
  state: ReservationState;
  soldOut: boolean;
  isAuthenticated: boolean;
  onReserve: () => void;
  onCheckout: () => void;
  onCancel: () => void;
  onReset: () => void;
  onLogin: () => void;
}

export function ReserveButton({
  state,
  soldOut,
  isAuthenticated,
  onReserve,
  onCheckout,
  onCancel,
  onReset,
  onLogin,
}: Props) {
  if (!isAuthenticated) {
    return (
      <button className="reserve-button primary" onClick={onLogin}>
        SIGN IN TO RESERVE
      </button>
    );
  }

  if (soldOut && state.type === "idle") {
    return (
      <button className="reserve-button disabled" disabled>
        SOLD OUT
      </button>
    );
  }

  switch (state.type) {
    case "idle":
      return (
        <button className="reserve-button primary" onClick={onReserve}>
          RESERVE NOW
        </button>
      );

    case "reserving":
      return (
        <button className="reserve-button disabled" disabled>
          RESERVING...
        </button>
      );

    case "active":
      return (
        <div className="reserve-group">
          <button className="reserve-button secondary" onClick={onCheckout}>
            COMPLETE CHECKOUT →
          </button>
          <button className="reserve-button danger" onClick={onCancel}>
            Cancel reservation
          </button>
        </div>
      );

    case "checking-out":
      return (
        <button className="reserve-button disabled" disabled>
          PROCESSING...
        </button>
      );

    case "complete":
      return (
        <div className="reserve-message complete">
          <p style={{ fontSize: "20px", marginBottom: "6px" }}>✅</p>
          <p
            style={{
              fontWeight: 700,
              fontSize: "13px",
              letterSpacing: "0.1em",
            }}
          >
            ORDER CONFIRMED
          </p>
          <p style={{ fontSize: "11px", marginTop: "4px" }}>
            Order ID: {state.orderId.slice(0, 8)}…
          </p>
        </div>
      );

    case "expired":
      return (
        <div className="reserve-group">
          <div className="reserve-message error">⏰ RESERVATION EXPIRED</div>
          <button className="reserve-button ghost" onClick={onReset}>
            Try Again
          </button>
        </div>
      );

    case "cancelled":
      return (
        <div className="reserve-group">
          <div className="reserve-message info">Reservation cancelled</div>
          <button className="reserve-button primary" onClick={onReset}>
            RESERVE AGAIN
          </button>
        </div>
      );

    case "error":
      return (
        <div className="reserve-group">
          <div className="reserve-message error">{state.message}</div>
          <button className="reserve-button ghost" onClick={onReset}>
            Dismiss
          </button>
        </div>
      );
  }
}
