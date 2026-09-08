import type { RequestHandler } from "express";
import { catalogService } from "./catalog.service";

export const catalogController = {
  listProducts: (async (req, res) => {
    const data = await catalogService.listProducts(req.query as any);
    res.json({ success: true, message: "OK", ...data });
  }) as RequestHandler,

  getProduct: (async (req, res) => {
    const data = await catalogService.getProduct(Number(req.params.id));
    res.json({ success: true, message: "OK", data });
  }) as RequestHandler,

  updateProduct: (async (req, res) => {
    const data = await catalogService.updateProduct(Number(req.params.id), req.body);
    res.json({ success: true, message: "Đã cập nhật sản phẩm", data });
  }) as RequestHandler,

  getPackaging: (async (req, res) => {
    const data = await catalogService.getPackaging(Number(req.params.id));
    res.json({ success: true, message: "OK", data });
  }) as RequestHandler,

  updatePackaging: (async (req, res) => {
    const data = await catalogService.updatePackaging(Number(req.params.id), req.body);
    res.json({ success: true, message: "Đã cập nhật quy cách hàng hóa", data });
  }) as RequestHandler,

  listWarehouses: (async (_req, res) => {
    const data = await catalogService.listWarehouses();
    res.json({ success: true, message: "OK", data });
  }) as RequestHandler,
};
