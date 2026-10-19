import type { Request, Response } from "express";
import { reportingService } from "./reporting.service";
export const reportingController = {
  async inventorySummary(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo tổng hợp tồn kho thành công", data: await reportingService.inventorySummary(req.query as any) }); },
  async itemLedger(req: Request, res: Response) { res.json({ success: true, message: "Lấy sổ chi tiết vật tư thành công", data: await reportingService.itemLedger(req.query as any) }); },
  async salesProfit(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo doanh thu và lợi nhuận thành công", data: await reportingService.salesProfit(req.query as any) }); },
  async operations(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo sản xuất và lắp ráp thành công", data: await reportingService.operations(req.query as any) }); },
  async productionVariance(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo chênh lệch sản xuất thành công", data: await reportingService.productionVariance(req.query as any) }); },
  async salesByCustomer(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo bán hàng theo khách hàng thành công", data: await reportingService.salesByCustomer(req.query as any) }); },
  async salesByProduct(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo bán hàng theo sản phẩm thành công", data: await reportingService.salesByProduct(req.query as any) }); },
  async productionOverview(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo tổng quan sản xuất thành công", data: await reportingService.productionOverview(req.query as any) }); },
  async transfers(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo chuyển kho thành công", data: await reportingService.transfers(req.query as any) }); },
  async purchasesBySupplier(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo mua hàng theo nhà cung cấp thành công", data: await reportingService.purchasesBySupplier(req.query as any) }); },
  async purchasesByProduct(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo mua hàng theo mặt hàng thành công", data: await reportingService.purchasesByProduct(req.query as any) }); },
  async salesReturns(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo trả hàng bán thành công", data: await reportingService.salesReturns(req.query as any) }); },
  async stockOnHand(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo tồn kho hiện tại thành công", data: await reportingService.stockOnHand(req.query as any) }); },
  async financialSummary(req: Request, res: Response) { res.json({ success: true, message: "Lấy báo cáo tài chính tổng quan thành công", data: await reportingService.financialSummary(req.query as any) }); },
};