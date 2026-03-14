import { useCallback, useEffect, useRef, useState } from "react";
import { productApi } from "../api";
import type { Product } from "../types";

const POLL_INTERVAL_MS = 5_000;

interface UseProductResult {
  product: Product | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useProduct(productId: string): UseProductResult {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const data = await productApi.getById(productId);
        if (mountedRef.current) {
          setProduct(data);
          setError(null);
        }
      } catch (err: unknown) {
        if (mountedRef.current) {
          const msg =
            err instanceof Error ? err.message : "Failed to load product";
          setError(msg);
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [productId],
  );

  useEffect(() => {
    mountedRef.current = true;

    fetch(true);

    intervalRef.current = setInterval(() => fetch(false), POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetch]);

  const refresh = useCallback(() => fetch(false), [fetch]);

  return { product, loading, error, refresh };
}
