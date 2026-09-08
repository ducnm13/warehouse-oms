import type { Request, Response } from "express";
import type { PromotionPreviewInput, PromotionProgramInput, PromotionUpdateInput } from "@challenge/contracts";
import { promotionService } from "./promotion.service";
const id = (req: Request) => Number(req.params.id), user = (req: Request) => { if (!req.auth) throw new Error("Auth middleware missing"); return req.auth.userId; };
export const promotionController = {
  async list(req: Request, res: Response) { const result = await promotionService.list(req.query as any); res.json({ success: true, message: "Lấy danh sách khuyến mãi thành công", data: result.data, meta: result.meta }); },
  async get(req: Request, res: Response) { res.json({ success: true, message: "Lấy chương trình thành công", data: await promotionService.get(id(req)) }); },
  async create(req: Request<Record<string,string>,unknown,PromotionProgramInput>, res: Response) { res.status(201).json({ success: true, message: "Đã tạo chương trình khuyến mãi", data: await promotionService.create(req.body, user(req)) }); },
  async update(req: Request<Record<string,string>,unknown,PromotionUpdateInput>, res: Response) { res.json({ success: true, message: "Đã cập nhật chương trình", data: await promotionService.update(id(req), req.body, user(req)) }); },
  async activate(req: Request, res: Response) { res.json({ success: true, message: "Đã kích hoạt chương trình", data: await promotionService.action(id(req), Number(req.body.version), "ACTIVE", user(req)) }); },
  async deactivate(req: Request, res: Response) { res.json({ success: true, message: "Đã ngừng chương trình", data: await promotionService.action(id(req), Number(req.body.version), "INACTIVE", user(req)) }); },
  async preview(req: Request<Record<string,string>,unknown,PromotionPreviewInput>, res: Response) { res.json({ success: true, message: "Đã tính khuyến mãi", data: await promotionService.preview(req.body) }); },
};