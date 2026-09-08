import type { RequestHandler } from "express";
import { openingInventoryService } from "./opening-inventory.service";

export const openingInventoryController = {
  list: async (req: any, res: any) => {
    const data = await openingInventoryService.list(req.query as any);
    res.json({ success: true, message: "OK", ...data });
  },

  get: async (req: any, res: any) => {
    const data = await openingInventoryService.get(Number(req.params.id));
    res.json({ success: true, message: "OK", data });
  },

  create: async (req: any, res: any) => {
    const data = await openingInventoryService.create(req.body, req.auth!.userId);
    res.status(201).json({ success: true, message: "Đã tạo phiếu tồn đầu kỳ", data });
  },

  update: async (req: any, res: any) => {
    const data = await openingInventoryService.update(Number(req.params.id), req.body, req.auth!.userId);
    res.json({ success: true, message: "Đã cập nhật phiếu tồn đầu kỳ", data });
  },

  post: async (req: any, res: any) => {
    const data = await openingInventoryService.post(Number(req.params.id), req.body.version, req.auth!.userId);
    res.json({ success: true, message: "Đã ghi sổ phiếu tồn đầu kỳ", data });
  },

  cancel: async (req: any, res: any) => {
    const data = await openingInventoryService.cancel(Number(req.params.id), req.body, req.auth!.userId);
    res.json({ success: true, message: "Đã hủy phiếu tồn đầu kỳ", data });
  },
};
