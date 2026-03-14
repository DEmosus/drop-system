import { Request, Response } from "express";
import { HTTP_STATUS } from "../../config/constants";
import { authService } from "./auth.service";

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as { email: string; password: string };
    const result = await authService.register(email, password);
    res.status(HTTP_STATUS.CREATED).json({ success: true, data: result });
  },

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as { email: string; password: string };
    const result = await authService.login(email, password);
    res.status(HTTP_STATUS.OK).json({ success: true, data: result });
  },
};
