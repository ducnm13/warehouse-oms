import type { Request, Response } from "express";
import type { InventoryCancelInput, InventoryDeleteInput, InventoryDraftInput, InventoryUpdateInput, StocktakeDraftInput, StocktakeUpdateInput } from "@challenge/contracts";
import { inventoryService, stocktakeService } from "./inventory.service";

const id = (req: Request) => Number(req.params.id);
const auth = (req: Request) => {
  if (!req.auth) throw new Error("Auth middleware missing");
  return req.auth;
};

export const inventoryController = {
  async list(req: Request, res: Response) {
    const result = await inventoryService.list(req.query);
    res.json({ success: true, message: "Lấy danh sách phiếu kho thành công", data: result.data, meta: result.meta });
  },
  async get(req: Request, res: Response) {
    res.json({ success: true, message: "Lấy phiếu kho thành công", data: await inventoryService.get(id(req)) });
  },
  async getByCodes(req: Request, res: Response) {
    const raw = req.query.codes;
    const codes = (Array.isArray(raw) ? raw.join(",") : String(raw || ""))
      .split(",")
      .map(code => code.trim())
      .filter(Boolean);
    if (!codes.length) {
      res.json({ success: true, message: "Không có mã phiếu kho cần tra", data: [] });
      return;
    }
    res.json({ success: true, message: "Lấy phiếu kho theo mã thành công", data: await inventoryService.getByCodes(codes) });
  },
  async create(req: Request<Record<string, string>, unknown, InventoryDraftInput>, res: Response) {
    res.status(201).json({ success: true, message: "Đã lưu nháp phiếu kho", data: await inventoryService.create(req.body, auth(req).userId) });
  },
  async update(req: Request<Record<string, string>, unknown, InventoryUpdateInput>, res: Response) {
    res.json({ success: true, message: "Đã cập nhật phiếu kho", data: await inventoryService.update(id(req), req.body, auth(req).userId) });
  },
  async post(req: Request, res: Response) {
    res.json({ success: true, message: "Đã ghi sổ phiếu kho", data: await inventoryService.post(id(req), Number(req.body.version), auth(req).userId) });
  },
  async cancel(req: Request<Record<string, string>, unknown, InventoryCancelInput>, res: Response) {
    res.json({ success: true, message: "Đã hủy và đảo phiếu kho", data: await inventoryService.cancel(id(req), req.body, auth(req).userId) });
  },
  async delete(req: Request<Record<string, string>, unknown, InventoryDeleteInput>, res: Response) {
    res.json({ success: true, message: "Đã xóa phiếu kho", data: await inventoryService.delete(id(req), req.body, auth(req).userId) });
  },
  async balances(req: Request, res: Response) {
    res.json({ success: true, message: "Lấy số dư kho thành công", data: await inventoryService.balances(req.query) });
  },
  async reconciliation(req: Request, res: Response) {
    const result = await inventoryService.reconciliation(req.query);
    res.json({ success: true, message: "Đối soát kho thành công", data: result.data, meta: result.summary });
  },
};

export const stocktakeController = {
  async list(req: Request, res: Response) {
    const result = await stocktakeService.list(req.query);
    res.json({ success: true, message: "Lấy danh sách kiểm kê thành công", data: result.data, meta: result.meta });
  },
  async get(req: Request, res: Response) {
    res.json({ success: true, message: "Lấy phiếu kiểm kê thành công", data: await stocktakeService.get(id(req)) });
  },
  async create(req: Request<Record<string, string>, unknown, StocktakeDraftInput>, res: Response) {
    res.status(201).json({ success: true, message: "Đã lưu nháp kiểm kê", data: await stocktakeService.create(req.body, auth(req).userId) });
  },
  async update(req: Request<Record<string, string>, unknown, StocktakeUpdateInput>, res: Response) {
    res.json({ success: true, message: "Đã cập nhật kiểm kê", data: await stocktakeService.update(id(req), req.body, auth(req).userId) });
  },
  async complete(req: Request, res: Response) {
    res.json({ success: true, message: "Đã chốt và điều chỉnh kiểm kê", data: await stocktakeService.complete(id(req), Number(req.body.version), auth(req).userId) });
  },
  async cancel(req: Request<Record<string, string>, unknown, InventoryCancelInput>, res: Response) {
    res.json({ success: true, message: "Đã hủy và đảo kiểm kê", data: await stocktakeService.cancel(id(req), req.body, auth(req).userId) });
  },
  async delete(req: Request<Record<string, string>, unknown, InventoryDeleteInput>, res: Response) {
    res.json({ success: true, message: "Đã xóa phiếu kiểm kê", data: await stocktakeService.delete(id(req), req.body, auth(req).userId) });
  },
};