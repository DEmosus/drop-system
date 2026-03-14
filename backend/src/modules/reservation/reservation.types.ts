import { ReservationStatus } from "@prisma/client";

export interface ReservationResponse {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReserveInput {
  userId: string;
  productId: string;
  quantity: number;
}

export interface ReserveResult {
  reservationId: string;
  expiresAt: Date;
  expiresInSeconds: number;
}

export interface CheckoutResult {
  orderId: string;
}
