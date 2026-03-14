import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { reserveRateLimit } from "../../middleware/rateLimit.middleware";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../utils/helpers/asyncHandler";
import {
    checkoutSchema,
    reserveSchema,
} from "../../validators/reservation.schema";
import { reservationController } from "./reservation.controller";

export const reservationRouter = Router();

// All reservation routes require auth
reservationRouter.use(authenticate);

// POST /reserve — create a reservation (strict rate limit)
reservationRouter.post(
  "/reserve",
  reserveRateLimit,
  validate(reserveSchema),
  asyncHandler(reservationController.reserve),
);

// POST /checkout — complete a reservation → order
reservationRouter.post(
  "/checkout",
  validate(checkoutSchema),
  asyncHandler(reservationController.checkout),
);

// DELETE /reservations/:id — cancel a reservation
reservationRouter.delete(
  "/reservations/:id",
  asyncHandler(reservationController.cancel),
);

// GET /reservations — list my reservations
reservationRouter.get(
  "/reservations",
  asyncHandler(reservationController.listMine),
);
