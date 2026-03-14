import type { AxiosError, AxiosInstance } from "axios";
import axios from "axios";
import type {
  ApiResponse,
  AuthResponse,
  CheckoutPayload,
  CheckoutResponse,
  LoginPayload,
  Product,
  RegisterPayload,
  ReservePayload,
  ReserveResponse,
} from "../types";

// ── Client setup ──────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10_000,
});

// Attach JWT on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Error normalisation ───────────────────────────────────────────────────────

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

function normalise(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const ae = err as AxiosError<{ code?: string; message?: string }>;
    const data = ae.response?.data;
    throw new ApiError(
      data?.code ?? "UNKNOWN",
      data?.message ?? ae.message,
      ae.response?.status,
    );
  }
  throw err;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    try {
      const { data } = await client.post<ApiResponse<AuthResponse>>(
        "/api/auth/register",
        payload,
      );
      return data.data;
    } catch (err) {
      normalise(err);
    }
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    try {
      const { data } = await client.post<ApiResponse<AuthResponse>>(
        "/api/auth/login",
        payload,
      );
      return data.data;
    } catch (err) {
      normalise(err);
    }
  },
};

// ── Products ──────────────────────────────────────────────────────────────────

export const productApi = {
  async getById(id: string): Promise<Product> {
    try {
      const { data } = await client.get<ApiResponse<Product>>(
        `/api/products/${id}`,
      );
      return data.data;
    } catch (err) {
      normalise(err);
    }
  },

  //   getAll: async (): Promise<Product[]> => {
  //   const res = await api.get<{ success: boolean; data: Product[] }>("/products");
  //   return res.data.data;
  // },

  async getAll(): Promise<Product[]> {
    try {
      const { data } =
        await client.get<ApiResponse<Product[]>>("/api/products");
      return data.data;
    } catch (err) {
      normalise(err);
    }
  },
};

// ── Reservations ──────────────────────────────────────────────────────────────

export const reservationApi = {
  async reserve(payload: ReservePayload): Promise<ReserveResponse> {
    try {
      const { data } = await client.post<ApiResponse<ReserveResponse>>(
        "/api/reserve",
        payload,
      );
      return data.data;
    } catch (err) {
      normalise(err);
    }
  },

  async checkout(payload: CheckoutPayload): Promise<CheckoutResponse> {
    try {
      const { data } = await client.post<ApiResponse<CheckoutResponse>>(
        "/api/checkout",
        payload,
      );
      return data.data;
    } catch (err) {
      normalise(err);
    }
  },

  async cancel(reservationId: string): Promise<void> {
    try {
      await client.delete(`/api/reservations/${reservationId}`);
    } catch (err) {
      normalise(err);
    }
  },
};
