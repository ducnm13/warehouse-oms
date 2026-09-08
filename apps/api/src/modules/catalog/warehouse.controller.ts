import type { RequestHandler } from "express";
import { warehouseService } from "./warehouse.service";

export const warehouseController = {
  list: (async (_req: any, res: any) => {
    const data = await warehouseService.list();
    res.json({ success: true, message: "OK", data });
  }) as RequestHandler,

  get: (async (req: any, res: any) => {
    const data = await warehouseService.get(Number(req.params.id));
    res.json({ success: true, message: "OK", data });
  }) as RequestHandler,

  create: (async (req: any, res: any) => {
    const data = await warehouseService.create(req.body);
    res.status(201).json({ success: true, message: "Đã thêm kho mới", data });
  }) as RequestHandler,

  update: (async (req: any, res: any) => {
    const data = await warehouseService.update(Number(req.params.id), req.body);
    res.json({ success: true, message: "Đã cập nhật kho", data });
  }) as RequestHandler,

  delete: (async (req: any, res: any) => {
    await warehouseService.delete(Number(req.params.id));
    res.json({ success: true, message: "Đã xóa kho", data: null });
  }) as RequestHandler,
};
