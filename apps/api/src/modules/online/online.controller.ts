import type { Request, Response } from "express";
import type { OnlineOrderInput, OnlineProductInput } from "@challenge/contracts";
import { onlineService } from "./online.service";

const id = (req: Request) => Number(req.params.id);
const user = (req: Request) => {
  if (!req.auth) throw new Error("Auth middleware missing");
  return req.auth.userId;
};

export const onlineController = {
  async listProducts(_req: Request, res: Response) {
    res.json({ success: true, message: "Lấy danh sách sản phẩm online thành công", data: await onlineService.listProducts() });
  },
  async createProduct(req: Request<Record<string, string>, unknown, OnlineProductInput>, res: Response) {
    res.status(201).json({ success: true, message: "Đã thêm sản phẩm online", data: await onlineService.createProduct(req.body) });
  },
  async updateProduct(req: Request<Record<string, string>, unknown, OnlineProductInput>, res: Response) {
    res.json({ success: true, message: "Đã cập nhật sản phẩm online", data: await onlineService.updateProduct(id(req), req.body) });
  },
  async syncNames(_req: Request, res: Response) {
    res.json({ success: true, message: "Đã đồng bộ tên sản phẩm từ kho", data: await onlineService.syncNames() });
  },
  async listOrders(req: Request, res: Response) {
    const result = await onlineService.listOrders(req.query as any);
    res.json({ success: true, message: "Lấy danh sách đơn online thành công", data: result.data, meta: result.meta });
  },
  async createOrder(req: Request<Record<string, string>, unknown, OnlineOrderInput>, res: Response) {
    res.status(201).json({ success: true, message: "Đã tạo đơn hàng online", data: await onlineService.createOrder(req.body, user(req)) });
  },
  async updateStatus(req: Request, res: Response) {
    res.json({ success: true, message: "Đã cập nhật trạng thái đơn online", data: await onlineService.updateStatus(id(req), String(req.body.status)) });
  },
  async remove(req: Request, res: Response) {
    res.json({ success: true, message: "Đã xóa đơn hàng online", data: await onlineService.remove(id(req)) });
  },
  async updateTracking(req: Request, res: Response) {
    res.json({ success: true, message: "Đã cập nhật mã vận đơn", data: await onlineService.updateTracking(id(req), String(req.body.tracking_number || "")) });
  },
  async syncShipments(_req: Request, res: Response) {
    const result = await onlineService.syncShipments();
    res.json({ success: true, message: `Đã đồng bộ ${result.checked} đơn (${result.changed} đổi trạng thái)`, data: result });
  },
  async trackingInfo(req: Request, res: Response) {
    res.json({ success: true, message: "Đã lấy thông tin vận chuyển", data: await onlineService.trackingInfo(String(req.params.trackingNumber)) });
  },
  async stats(_req: Request, res: Response) {
    res.json({ success: true, message: "Đã lấy thống kê bán online", data: await onlineService.stats() });
  },
  async topProducts(req: Request, res: Response) {
    res.json({ success: true, message: "Đã lấy báo cáo sản phẩm bán chạy", data: await onlineService.topProducts(req.query as any) });
  },
  async monthlyReport(req: Request, res: Response) {
    const months = Math.min(Math.max(Number((req.query as any).months || 12), 1), 24);
    res.json({ success: true, message: "Đã lấy báo cáo doanh số theo tháng", data: await onlineService.monthlyReport(months) });
  },
  async nextCode(_req: Request, res: Response) {
    res.json({ success: true, message: "OK", data: await onlineService.nextCode() });
  },
};
