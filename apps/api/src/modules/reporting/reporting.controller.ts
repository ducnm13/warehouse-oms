import type { Request, Response } from "express";
import { reportingService } from "./reporting.service";
export const reportingController = {
  async inventorySummary(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo tổng hợp tồn kho thành công", data: await reportingService.inventorySummary(req.query as any) }); },
  async itemLedger(req: Request, res: Response) { res.json({ success: true, message: "Lấy sổ chi tiết vật tư thành công", data: await reportingService.itemLedger(req.query as any) }); },
  async salesProfit(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo doanh thu và lợi nhuận thành công", data: await reportingService.salesProfit(req.query as any) }); },
  async operations(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo sản xuất và lắp ráp thành công", data: await reportingService.operations(req.query as any) }); },
};