import { Request, Response } from "express";
import { HTTP_STATUS } from "../../config/constants";
import { buildPagination } from "../../utils/helpers/pagination";
import { reservationService } from "./reservation.service";

export const reservationController = {
  async reserve(req: Request, res: Response): Promise<void> {
    const { productId, quantity } = req.body as {
      productId: string;
      quantity: number;
    };
    const userId = req.user!.userId;
    const result = await reservationService.reserve(
      userId,
      productId,
      quantity,
    );
    res.status(HTTP_STATUS.CREATED).json({ success: true, data: result });
  },

  async checkout(req: Request, res: Response): Promise<void> {
    const { reservationId } = req.body as { reservationId: string };
    const userId = req.user!.userId;
    const result = await reservationService.checkout(reservationId, userId);
    res.status(HTTP_STATUS.OK).json({ success: true, data: result });
  },

  async cancel(req: Request, res: Response): Promise<void> {
    const id = req.params["id"] as string;
    const userId = req.user!.userId;
    await reservationService.cancel(id, userId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },

  async listMine(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10)),
    );
    const { items, total } = await reservationService.getByUser(
      userId,
      page,
      limit,
    );
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: items,
      pagination: buildPagination(page, limit, total),
    });
  },
};
