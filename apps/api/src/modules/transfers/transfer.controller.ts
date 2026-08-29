import type { Request, Response } from "express";
import type { TransferCancelInput, TransferDraftInput, TransferUpdateInput } from "@challenge/contracts";
import { transferService } from "./transfer.service";

const id = (req: Request) => Number(req.params.id);
const auth = (req: Request) => {
  if (!req.auth) throw new Error("Auth middleware missing");
  return req.auth;
};

export const transferController = {
  async list(req: Request, res: Response) {
    const result = await transferService.list(req.query as any);
    res.json({ success: true, message: "Lấy danh sách chuyển kho thành công", data: result.data, meta: result.meta });
  },
  async get(req: Request, res: Response) {
    res.json({ success: true, message: "Lấy phiếu chuyển kho thành công", data: await transferService.get(id(req)) });
  },
  async create(req: Request<Record<string, string>, unknown, TransferDraftInput>, res: Response) {
    res.status(201).json({ success: true, message: "Đã lưu nháp chuyển kho", data: await transferService.create(req.body, auth(req).userId) });
  },
  async update(req: Request<Record<string, string>, unknown, TransferUpdateInput>, res: Response) {
    res.json({ success: true, message: "Đã cập nhật chuyển kho", data: await transferService.update(id(req), req.body, auth(req).userId) });
  },
  async ship(req: Request, res: Response) {
    res.json({ success: true, message: "Đã xuất hàng khỏi kho nguồn", data: await transferService.ship(id(req), Number(req.body.version), auth(req).userId) });
  },
  async receive(req: Request, res: Response) {
    res.json({ success: true, message: "Đã nhận hàng vào kho đích", data: await transferService.receive(id(req), Number(req.body.version), auth(req).userId) });
  },
  async cancel(req: Request<Record<string, string>, unknown, TransferCancelInput>, res: Response) {
    res.json({ success: true, message: "Đã hủy chuyển kho", data: await transferService.cancel(id(req), req.body, auth(req).userId) });
  },
};