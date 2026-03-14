import "./CountdownTimer.css";

interface Props {
  formatted: string;
  secondsLeft: number;
  isExpired: boolean;
}

const SIZE = 72;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CountdownTimer({ formatted, secondsLeft, isExpired }: Props) {
  const TOTAL = 5 * 60;
  const progress = Math.max(0, Math.min(1, secondsLeft / TOTAL));
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const urgent = secondsLeft <= 60 && !isExpired;

  const colour = isExpired
    ? "var(--error)"
    : urgent
      ? "var(--warning)"
      : "var(--accent-cyan)";

  const wrapClass = isExpired
    ? "countdown-wrap expired"
    : urgent
      ? "countdown-wrap urgent"
      : "countdown-wrap default";

  return (
    <div className={wrapClass}>
      <svg
        width={SIZE}
        height={SIZE}
        style={{ flexShrink: 0, transform: "rotate(-90deg)" }}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--bg-tertiary)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={colour}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 0.9s linear, stroke 0.3s ease",
          }}
        />
      </svg>

      <div>
        <p className="countdown-label">
          {isExpired ? "RESERVATION EXPIRED" : "TIME REMAINING"}
        </p>
        <p className="countdown-time" style={{ color: colour }}>
          {isExpired ? "00:00" : formatted}
        </p>

        {!isExpired && (
          <p className={`countdown-message ${urgent ? "urgent" : "default"}`}>
            {urgent ? "⚠ Checkout now" : "Complete checkout before timer ends"}
          </p>
        )}
        {isExpired && (
          <p className="countdown-message expired">
            Stock has been released back
          </p>
        )}
      </div>
    </div>
  );
}
