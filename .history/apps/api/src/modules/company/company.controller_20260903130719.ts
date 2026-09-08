import type { RequestHandler } from "express";
import { companyService } from "./company.service";

export const companyController = {
  getAll: (async (req, res) => {
    const data = await companyService.getAll();
    res.json({ success: true, message: "OK", data });
  }) as RequestHandler,

  updateProfile: (async (req, res) => {
    const data = await companyService.updateProfile(req.body, req.auth!.userId);
    res.json({ success: true, message: "Đã lưu thông tin doanh nghiệp", data });
  }) as RequestHandler,

  updateSignatures: (async (req, res) => {
    const data = await companyService.updateSignatures(req.body, req.auth!.userId);
    res.json({ success: true, message: "Đã lưu thông tin chữ ký", data });
  }) as RequestHandler,

  updatePrintSettings: (async (req, res) => {
    const data = await companyService.updatePrintSettings(req.body, req.auth!.userId);
    res.json({ success: true, message: "Đã lưu cài đặt in ấn", data });
  }) as RequestHandler,
};
