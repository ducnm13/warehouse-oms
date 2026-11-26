import type { Request, Response } from "express";
import { costingService } from "./costing.service";

const id = (req: Request) => Number(req.params.id);
const user = (req: Request) => {
  if (!req.auth) throw new Error("Auth middleware missing");
  return req.auth.userId;
};

export const costingController = {
  async costCenters(req: Request, res: Response) {
    res.json({
      success: true,
      message: "Lấy danh sách đối tượng chi phí thành công",
      data: await costingService.costCenters(req.query as any),
    });
  },
  async createCostCenter(req: Request, res: Response) {
    res.status(201).json({
      success: true,
      message: "Đã tạo đối tượng chi phí",
      data: await costingService.createCostCenter(req.body, user(req)),
    });
  },
  async updateCostCenter(req: Request, res: Response) {
    res.json({
      success: true,
      message: "Đã cập nhật đối tượng chi phí",
      data: await costingService.updateCostCenter(id(req), req.body, user(req)),
    });
  },

  async entries(req: Request, res: Response) {
    const result = await costingService.entries(req.query as any);
    res.json({
      success: true,
      message: "Lấy danh sách chứng từ chi phí thành công",
      data: result.data,
      meta: result.meta,
    });
  },
  async entry(req: Request, res: Response) {
    res.json({
      success: true,
      message: "Lấy chi tiết chứng từ chi phí thành công",
      data: await costingService.entry(id(req)),
    });
  },
  async createEntry(req: Request, res: Response) {
    res.status(201).json({
      success: true,
      message: "Đã tạo chứng từ chi phí",
      data: await costingService.createEntry(req.body, user(req)),
    });
  },
  async updateEntry(req: Request, res: Response) {
    res.json({
      success: true,
      message: "Đã cập nhật chứng từ chi phí",
      data: await costingService.updateEntry(id(req), req.body, user(req)),
    });
  },
  async removeEntry(req: Request, res: Response) {
    await costingService.removeEntry(id(req), user(req));
    res.json({ success: true, message: "Đã xóa chứng từ chi phí", data: null });
  },

  async warehouses(_req: Request, res: Response) {
    res.json({
      success: true,
      message: "OK",
      data: await costingService.warehouses(),
    });
  },
  async productionOrders(req: Request, res: Response) {
    res.json({
      success: true,
      message: "OK",
      data: await costingService.productionOrders(
        typeof req.query.search === "string" ? req.query.search : undefined,
      ),
    });
  },
  async assemblyOrders(req: Request, res: Response) {
    res.json({
      success: true,
      message: "OK",
      data: await costingService.assemblyOrders(
        typeof req.query.search === "string" ? req.query.search : undefined,
      ),
    });
  },

  async unbilledIncidents(req: Request, res: Response) {
    res.json({
      success: true,
      message: "Lấy sự cố chưa hạch toán thành công",
      data: await costingService.unbilledIncidents(req.query as any),
    });
  },
  async importIncidents(req: Request, res: Response) {
    res.status(201).json({
      success: true,
      message: "Đã nhập chi phí từ sự cố kỹ thuật",
      data: await costingService.importIncidents(req.body, user(req)),
    });
  },

  async sheets(req: Request, res: Response) {
    const result = await costingService.sheets(req.query as any);
    res.json({
      success: true,
      message: "Lấy lịch sử bảng tính giá thành thành công",
      data: result.data,
      meta: result.meta,
    });
  },
  async sheet(req: Request, res: Response) {
    res.json({
      success: true,
      message: "Lấy chi tiết bảng tính giá thành thành công",
      data: await costingService.sheet(id(req)),
    });
  },
  async createSheet(req: Request, res: Response) {
    res.status(201).json({
      success: true,
      message: "Đã chốt bảng tính giá thành",
      data: await costingService.createSheet(req.body, user(req)),
    });
  },
  async removeSheet(req: Request, res: Response) {
    await costingService.removeSheet(id(req), user(req));
    res.json({ success: true, message: "Đã xóa bảng tính giá thành", data: null });
  },
};
