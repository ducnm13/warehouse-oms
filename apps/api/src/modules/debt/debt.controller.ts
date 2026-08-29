import type { Request, Response } from "express";
import type { DebtCancelInput, DebtPaymentDraftInput, DebtPaymentUpdateInput } from "@challenge/contracts";
import { debtService } from "./debt.service";

const id = (req: Request) => BigInt(req.params.id);
const auth = (req: Request) => { if (!req.auth) throw new Error("Auth middleware missing"); return req.auth; };

export const debtController = {
  receivables: async (req: Request, res: Response) => res.json({ success: true, message: "Lấy công nợ phải thu thành công", data: await debtService.aging("RECEIPT", req.query) }),
  payables: async (req: Request, res: Response) => res.json({ success: true, message: "Lấy công nợ phải trả thành công", data: await debtService.aging("VOUCHER", req.query) }),
  receiptList: async (req: Request, res: Response) => { const result = await debtService.list("RECEIPT", req.query); res.json({ success: true, message: "Lấy phiếu thu thành công", data: result.data, meta: result.meta }); },
  voucherList: async (req: Request, res: Response) => { const result = await debtService.list("VOUCHER", req.query); res.json({ success: true, message: "Lấy phiếu chi thành công", data: result.data, meta: result.meta }); },
  receiptGet: async (req: Request, res: Response) => res.json({ success: true, message: "Lấy phiếu thu thành công", data: await debtService.get("RECEIPT", id(req)) }),
  voucherGet: async (req: Request, res: Response) => res.json({ success: true, message: "Lấy phiếu chi thành công", data: await debtService.get("VOUCHER", id(req)) }),
  receiptCreate: async (req: Request<Record<string, string>, unknown, DebtPaymentDraftInput>, res: Response) => res.status(201).json({ success: true, message: "Đã lưu nháp phiếu thu", data: await debtService.create("RECEIPT", req.body, auth(req).userId) }),
  voucherCreate: async (req: Request<Record<string, string>, unknown, DebtPaymentDraftInput>, res: Response) => res.status(201).json({ success: true, message: "Đã lưu nháp phiếu chi", data: await debtService.create("VOUCHER", req.body, auth(req).userId) }),
  receiptUpdate: async (req: Request<Record<string, string>, unknown, DebtPaymentUpdateInput>, res: Response) => res.json({ success: true, message: "Đã cập nhật phiếu thu", data: await debtService.update("RECEIPT", id(req), req.body, auth(req).userId) }),
  voucherUpdate: async (req: Request<Record<string, string>, unknown, DebtPaymentUpdateInput>, res: Response) => res.json({ success: true, message: "Đã cập nhật phiếu chi", data: await debtService.update("VOUCHER", id(req), req.body, auth(req).userId) }),
  receiptPost: async (req: Request, res: Response) => res.json({ success: true, message: "Đã ghi sổ phiếu thu", data: await debtService.post("RECEIPT", id(req), Number(req.body.version), auth(req).userId) }),
  voucherPost: async (req: Request, res: Response) => res.json({ success: true, message: "Đã ghi sổ phiếu chi", data: await debtService.post("VOUCHER", id(req), Number(req.body.version), auth(req).userId) }),
  receiptCancel: async (req: Request<Record<string, string>, unknown, DebtCancelInput>, res: Response) => res.json({ success: true, message: "Đã hủy và đảo phiếu thu", data: await debtService.cancel("RECEIPT", id(req), req.body, auth(req).userId) }),
  voucherCancel: async (req: Request<Record<string, string>, unknown, DebtCancelInput>, res: Response) => res.json({ success: true, message: "Đã hủy và đảo phiếu chi", data: await debtService.cancel("VOUCHER", id(req), req.body, auth(req).userId) }),
};