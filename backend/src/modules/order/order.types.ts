export interface OrderResponse {
  id: string;
  userId: string;
  reservationId: string;
  productId: string;
  quantity: number;
  status: string;
  createdAt: Date;
}

export interface CreateOrderInput {
  userId: string;
  reservationId: string;
  productId: string;
  quantity: number;
}
