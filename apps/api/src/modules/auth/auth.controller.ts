import type { Request, Response } from "express";
import type { LoginInput, RefreshInput } from "@challenge/contracts";
import { authService } from "./auth.service";

const context = (req: Request) => ({ ip: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) });

export const authController = {
  async login(req: Request<Record<string, string>, unknown, LoginInput>, res: Response) {
    const data = await authService.login(req.body, context(req));
    res.json({ success: true, message: "Đăng nhập thành công", data });
  },
  async refresh(req: Request<Record<string, string>, unknown, RefreshInput>, res: Response) {
    const data = await authService.refresh(req.body.refreshToken, context(req));
    res.json({ success: true, message: "Làm mới phiên thành công", data });
  },
  async logout(req: Request<Record<string, string>, unknown, RefreshInput>, res: Response) {
    await authService.logout(req.body.refreshToken);
    res.json({ success: true, message: "Đăng xuất thành công", data: null });
  },
  async me(req: Request, res: Response) {
    res.json({ success: true, message: "Lấy thông tin phiên thành công", data: req.auth });
  },
};