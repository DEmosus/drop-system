import { useState } from "react";
import { AuthModal } from "../components/AuthModal";
import { CountdownTimer } from "../components/CountdownTimer";
import { ReserveButton } from "../components/ReserveButton";
import { StockIndicator } from "../components/StockIndicator";
import { useAuth } from "../context/AuthContext";
import { useProduct } from "../hooks/useProduct";
import { useProducts } from "../hooks/useProducts";
import { useReservationTimer } from "../hooks/useReservationTimer";
import { useReserveProduct } from "../hooks/useReserveProduct";
import type { Product } from "../types";
import "./DropPage.css";

const SYSTEM_STATS = [
  { label: "TRANSACTION", value: "Serializable" },
  { label: "CONCURRENCY", value: "Row-lock safe" },
  { label: "EXPIRY", value: "5 min auto" },
  { label: "STOCK SYNC", value: "5s polling" },
] as const;

// ─── Live Badge ───────────────────────────────────────────────────────────────

function LiveBadge() {
  return (
    <div className="live-badge">
      <span className="live-badge-dot" />
      LIVE DROP
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton" style={{ height: 380, borderRadius: 16 }} />
      <div className="skeleton" style={{ height: 32, width: "70%" }} />
      <div className="skeleton" style={{ height: 20, width: "40%" }} />
      <div className="skeleton" style={{ height: 60 }} />
      <div className="skeleton" style={{ height: 52, borderRadius: 10 }} />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton-grid__item">
          <div className="skeleton skeleton-grid__image" />
          <div className="skeleton-grid__body">
            <div
              className="skeleton"
              style={{ height: 20, width: "70%", borderRadius: 4 }}
            />
            <div
              className="skeleton"
              style={{ height: 14, width: "40%", borderRadius: 4 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="error-state">
      <p className="error-state__icon">⚠</p>
      <p className="error-state__title">Failed to load</p>
      <p className="error-state__message">{message}</p>
    </div>
  );
}

// ─── System Footer ────────────────────────────────────────────────────────────

function SystemFooter() {
  return (
    <div className="system-footer">
      {SYSTEM_STATS.map(({ label, value }) => (
        <div key={label} className="system-footer__item">
          <p className="system-footer__label">{label}</p>
          <p className="system-footer__value">{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Drop Banner ──────────────────────────────────────────────────────────────

function DropBanner({ title }: { title: string }) {
  const words = title.split(" ");
  const last = words.slice(-1)[0];
  const rest = words.slice(0, -1).join(" ");
  const dateStr = new Date()
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();

  return (
    <div className="drop-banner">
      <p className="drop-banner-eyebrow">LIMITED DROP — {dateStr}</p>
      <h1 className="drop-banner-title">
        {rest} <span className="drop-banner-title-accent">{last}</span>
      </h1>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onClick,
}: {
  product: Product;
  onClick: () => void;
}) {
  const soldOut = product.availableStock === 0;
  const lowStock =
    !soldOut && product.availableStock / product.totalStock <= 0.2;

  return (
    <div
      className={`product-card${soldOut ? " product-card--sold-out" : ""}`}
      onClick={soldOut ? undefined : onClick}
    >
      <div className="product-card__image-wrap">
        {product.imageUrl ? (
          <img
            className="product-card__image"
            src={product.imageUrl}
            alt={product.name}
          />
        ) : (
          <div className="product-card__image-placeholder">📦</div>
        )}
        {soldOut && (
          <div className="product-card__sold-out-overlay">
            <span className="product-card__sold-out-label">SOLD OUT</span>
          </div>
        )}
        {lowStock && (
          <div className="product-card__low-stock-badge">
            ONLY {product.availableStock} LEFT
          </div>
        )}
      </div>
      <div className="product-card__body">
        <div className="product-card__meta">
          <h3 className="product-card__name">{product.name}</h3>
          <span className="product-card__price">
            ${product.price.toFixed(0)}
          </span>
        </div>
        <p className="product-card__description">{product.description}</p>
        <StockIndicator
          available={product.availableStock}
          total={product.totalStock}
        />
      </div>
    </div>
  );
}

// ─── Product Detail ───────────────────────────────────────────────────────────

function ProductDetail({
  productId,
  onBack,
  isAuthenticated,
  onLogin,
}: {
  productId: string;
  onBack: () => void;
  isAuthenticated: boolean;
  onLogin: () => void;
}) {
  const [quantity] = useState(1);
  const { product, loading, error } = useProduct(productId);
  const { state, reserve, checkout, cancel, reset } = useReserveProduct();

  const expiresAt = state.type === "active" ? state.expiresAt : null;
  const timer = useReservationTimer(expiresAt);

  if (timer.isExpired && state.type === "active") reset();

  const handleReserve = () => {
    if (product) reserve(product.id, quantity);
  };

  if (loading) return <SkeletonCard />;
  if (error) return <ErrorState message={error} />;
  if (!product) return null;

  return (
    <>
      <button className="btn btn-back" onClick={onBack}>
        ← All Drops
      </button>

      <DropBanner title={product.name} />

      <div className="detail-card">
        <div className="detail-grid">
          {/* Image */}
          <div className="detail-image-wrap">
            {product.imageUrl ? (
              <img
                className="detail-image"
                src={product.imageUrl}
                alt={product.name}
              />
            ) : (
              <div className="detail-image-placeholder">📦</div>
            )}
            <div className="detail-image-gradient" />
          </div>

          {/* Body */}
          <div className="detail-body">
            <div>
              <div className="detail-title-row">
                <h2 className="detail-name">{product.name}</h2>
                <span className="detail-price">
                  ${product.price.toFixed(0)}
                </span>
              </div>
              {product.description && (
                <p className="detail-description">{product.description}</p>
              )}
            </div>

            <div className="detail-stock-box">
              <StockIndicator
                available={product.availableStock}
                total={product.totalStock}
              />
              <p className="detail-stock-refresh">
                ↻ Refreshes every 5 seconds
              </p>
            </div>

            {(state.type === "active" || state.type === "checking-out") && (
              <CountdownTimer
                formatted={timer.formatted}
                secondsLeft={timer.secondsLeft}
                isExpired={timer.isExpired}
              />
            )}

            {state.type === "expired" && (
              <CountdownTimer
                formatted="00:00"
                secondsLeft={0}
                isExpired={true}
              />
            )}

            {state.type === "idle" && (
              <div className="detail-expiry-hint">
                <span>⏱</span>
                <span>
                  Reservations expire after 5 minutes if not checked out
                </span>
              </div>
            )}

            <ReserveButton
              state={state}
              soldOut={product.availableStock === 0}
              isAuthenticated={isAuthenticated}
              onReserve={handleReserve}
              onCheckout={checkout}
              onCancel={cancel}
              onReset={reset}
              onLogin={onLogin}
            />

            {product.availableStock > 0 &&
              product.availableStock <= 10 &&
              state.type === "idle" && (
                <p className="detail-low-stock-warning">
                  ⚡ ONLY {product.availableStock} LEFT
                </p>
              )}
          </div>
        </div>
      </div>

      <SystemFooter />
    </>
  );
}

// ─── Product List ─────────────────────────────────────────────────────────────

function ProductList({ onSelect }: { onSelect: (id: string) => void }) {
  const { products, loading, error } = useProducts();
  const dateStr = new Date()
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();

  return (
    <>
      <div className="grid-banner">
        <p className="drop-banner-eyebrow">LIMITED DROP — {dateStr}</p>
        <h1 className="grid-banner-title">
          This Season's <span className="drop-banner-title-accent">Drops</span>
        </h1>
        <p className="grid-banner-subtitle">
          {products.length > 0
            ? `${products.length} items available — click to reserve`
            : ""}
        </p>
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onClick={() => onSelect(p.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DropPage() {
  const { isAuthenticated, logout } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );

  return (
    <div className="page">
      <div className="grid-bg" />
      <div className="glow" />

      <header className="header">
        <div className="header-logo" onClick={() => setSelectedProductId(null)}>
          <span className="header-logo-drop">DROP</span>
          <span className="header-logo-system">SYSTEM</span>
        </div>
        <div className="header-actions">
          <LiveBadge />
          {isAuthenticated ? (
            <button className="btn btn-ghost" onClick={logout}>
              Sign Out
            </button>
          ) : (
            <button
              className="btn btn-outline-pink"
              onClick={() => setShowAuth(true)}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="main">
        {selectedProductId ? (
          <ProductDetail
            productId={selectedProductId}
            onBack={() => setSelectedProductId(null)}
            isAuthenticated={isAuthenticated}
            onLogin={() => setShowAuth(true)}
          />
        ) : (
          <ProductList onSelect={setSelectedProductId} />
        )}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
