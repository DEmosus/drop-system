import { useCallback, useEffect, useRef, useState } from "react";
import { productApi } from "../api";
import type { Product } from "../types";

const POLL_INTERVAL_MS = 5_000;

interface UseProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;
}

export function useProducts(): UseProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await productApi.getAll();
      if (mountedRef.current) {
        setProducts(data);
        setError(null);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to load products",
        );
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll(true);
    const id = setInterval(() => fetchAll(false), POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchAll]);

  return { products, loading, error };
}
