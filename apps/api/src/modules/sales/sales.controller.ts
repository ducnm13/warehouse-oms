import type { Request, Response } from "express";
import type { SalesCancelInput, SalesDraftInput, SalesPaymentInput, SalesRejectInput, SalesUpdateInput } from "@challenge/contracts";
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
  async create(req: Request<Record<string, string>, unknown, SalesDraftInput>, res: Response) {
    const user = auth(req);
    res.status(201).json({ success: true, message: "Đã lưu nháp đơn bán hàng", data: await salesService.createDraft(req.body, user.userId) });
  },
  async update(req: Request<Record<string, string>, unknown, SalesUpdateInput>, res: Response) {
    const user = auth(req);
    res.json({ success: true, message: "Đã cập nhật đơn bán hàng", data: await salesService.updateDraft(id(req), req.body, user.userId) });
  },
  async submit(req: Request, res: Response) {
    const user = auth(req);
    res.json({ success: true, message: "Đã gửi đơn chờ duyệt", data: await salesService.submit(id(req), Number(req.body.version), user.userId) });
  },
  async approve(req: Request, res: Response) {
    const user = auth(req);
    res.json({ success: true, message: "Đã duyệt đơn bán hàng", data: await salesService.approve(id(req), Number(req.body.version), user.userId) });
  },
  async reject(req: Request<Record<string, string>, unknown, SalesRejectInput>, res: Response) {
    const user = auth(req);
    res.json({ success: true, message: "Đã từ chối đơn bán hàng", data: await salesService.reject(id(req), req.body, user.userId) });
  },
  async post(req: Request, res: Response) {
    const user = auth(req);
    res.json({ success: true, message: "Đã ghi sổ, xuất kho và ghi nhận phải thu", data: await salesService.post(id(req), Number(req.body.version), user.userId) });
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