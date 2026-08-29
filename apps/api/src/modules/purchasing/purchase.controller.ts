import type { Request, Response } from "express";
import type { PurchaseCancelInput, PurchaseDraftInput, PurchaseUpdateInput } from "@challenge/contracts";
import { purchaseService } from "./purchase.service";

const id = (req: Request) => Number(req.params.id);
const auth = (req: Request) => {
  if (!req.auth) throw new Error("Auth middleware missing");
  return req.auth;
};

export const purchaseController = {
  async list(req: Request, res: Response) {
    const result = await purchaseService.list(req.query as any);
    res.json({ success: true, message: "Lấy danh sách chứng từ thành công", data: result.data, meta: result.meta });
  },
  async get(req: Request, res: Response) {
    res.json({ success: true, message: "Lấy chứng từ thành công", data: await purchaseService.get(id(req)) });
  },
  async create(req: Request<Record<string, string>, unknown, PurchaseDraftInput>, res: Response) {
    const user = auth(req);
    const data = await purchaseService.createDraft(req.body, user.userId, user.username);
    res.status(201).json({ success: true, message: "Đã lưu nháp chứng từ", data });
  },
  async update(req: Request<Record<string, string>, unknown, PurchaseUpdateInput>, res: Response) {
    const user = auth(req);
    res.json({ success: true, message: "Đã cập nhật nháp", data: await purchaseService.updateDraft(id(req), req.body, user.userId) });
  },
  async post(req: Request, res: Response) {
    const user = auth(req);
    res.json({ success: true, message: "Đã ghi sổ chứng từ", data: await purchaseService.post(id(req), Number(req.body.version), user.userId) });
  },
  async cancel(req: Request<Record<string, string>, unknown, PurchaseCancelInput>, res: Response) {
    const user = auth(req);
    res.json({ success: true, message: "Đã hủy và đảo chứng từ", data: await purchaseService.cancel(id(req), req.body, user.userId) });
  },
};