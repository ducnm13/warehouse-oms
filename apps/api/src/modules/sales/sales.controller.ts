import type { Request, Response } from "express";
import type { SalesCancelInput, SalesDraftInput, SalesPaymentInput, SalesUpdateInput } from "@challenge/contracts";
import { salesService } from "./sales.service";

const id = (req: Request) => Number(req.params.id);
const auth = (req: Request) => {
  if (!req.auth) throw new Error("Auth middleware missing");
  return req.auth;
};

export const salesController = {
  async list(req: Request, res: Response) {
    const result = await salesService.list(req.query as any);
    res.json({ success: true, message: "Lấy danh sách bán hàng thành công", data: result.data, meta: result.meta });
  },
  async get(req: Request, res: Response) {
    res.json({ success: true, message: "Lấy chứng từ bán hàng thành công", data: await salesService.get(id(req)) });
  },
  async packagingPrices(req: Request, res: Response) {
    const ids = String(req.query.ids || "")
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    const customerId = req.query.customerId ? Number(req.query.customerId) : undefined;
    res.json({ success: true, message: "OK", data: await salesService.packagingPrices(ids, customerId) });
  },
  async create(req: Request<Record<string, string>, unknown, SalesDraftInput>, res: Response) {
    const user = auth(req);
    res.status(201).json({ success: true, message: "Đã lưu nháp đơn bán hàng", data: await salesService.createDraft(req.body, user.userId) });
  },
  async update(req: Request<Record<string, string>, unknown, SalesUpdateInput>, res: Response) {
    const user = auth(req);
    res.json({ success: true, message: "Đã cập nhật đơn bán hàng", data: await salesService.updateDraft(id(req), req.body, user.userId) });
  },
  async remove(req: Request, res: Response) {
    const user = auth(req);
    res.json({ success: true, message: "Đã xóa chứng từ bán hàng", data: await salesService.deleteDraft(id(req), Number(req.body.version), user.userId) });
  },
  async post(req: Request, res: Response) {
    const user = auth(req);
    res.json({ success: true, message: "Đã lưu, xuất kho và ghi nhận phải thu", data: await salesService.post(id(req), Number(req.body.version), user.userId) });
  },
  async unpost(req: Request, res: Response) {
    const user = auth(req);
    res.json({ success: true, message: "Đã hủy lưu và khôi phục tồn kho", data: await salesService.unpost(id(req), Number(req.body.version), user.userId) });
  },
  async payment(req: Request<Record<string, string>, unknown, SalesPaymentInput>, res: Response) {
    const user = auth(req);
    res.json({ success: true, message: "Đã ghi nhận thu tiền", data: await salesService.receivePayment(id(req), req.body, user.userId) });
  },
  async cancel(req: Request<Record<string, string>, unknown, SalesCancelInput>, res: Response) {
    const user = auth(req);
    res.json({ success: true, message: "Đã hủy và đảo chứng từ bán hàng", data: await salesService.cancel(id(req), req.body, user.userId) });
  },
};