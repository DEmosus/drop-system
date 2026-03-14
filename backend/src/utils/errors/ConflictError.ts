import { AppError } from "./AppError";

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409, "CONFLICT");
  }
}

export class DuplicateReservationError extends AppError {
  constructor() {
    super(
      "You already have an active reservation for this product",
      409,
      "DUPLICATE_RESERVATION",
    );
  }
}

export class InsufficientStockError extends AppError {
  constructor() {
    super("Insufficient stock available", 409, "INSUFFICIENT_STOCK");
  }
}
