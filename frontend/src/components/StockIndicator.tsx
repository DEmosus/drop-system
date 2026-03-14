import "./StockIndicator.css";

interface Props {
  available: number;
  total: number;
}

export function StockIndicator({ available, total }: Props) {
  const pct = total > 0 ? available / total : 0;
  const soldOut = available === 0;
  const critical = !soldOut && pct <= 0.1;
  const low = !soldOut && !critical && pct <= 0.3;

  const colour = soldOut
    ? "var(--error)"
    : critical
      ? "var(--warning)"
      : low
        ? "#f5a623"
        : "var(--accent-cyan)";

  const label = soldOut ? "SOLD OUT" : `${available} / ${total} remaining`;

  return (
    <div className="stock-indicator">
      <div className="stock-indicator-row">
        <span className="stock-indicator-label">STOCK</span>
        <span className="stock-indicator-value" style={{ color: colour }}>
          {label}
        </span>
      </div>
      <div className="stock-indicator-bar">
        <div
          className="stock-indicator-fill"
          style={{ width: `${Math.max(pct * 100, 2)}%`, background: colour }}
        />
      </div>
      {(critical || soldOut) && (
        <p className="stock-indicator-warning" style={{ color: colour }}>
          {soldOut
            ? "⚠ This drop has sold out"
            : `⚡ Almost gone — ${available} left`}
        </p>
      )}
    </div>
  );
}
