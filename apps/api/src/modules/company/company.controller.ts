import { companyService } from "./company.service";

export const companyController = {
  getAll: async (_req: any, res: any) => {
    const data = await companyService.getAll();
    res.json({ success: true, message: "OK", data });
  },

  updateProfile: async (req: any, res: any) => {
    const data = await companyService.updateProfile(req.body, req.auth!.userId);
    res.json({ success: true, message: "Đã lưu thông tin doanh nghiệp", data });
  },

  updateSignatures: async (req: any, res: any) => {
    const data = await companyService.updateSignatures(req.body, req.auth!.userId);
    res.json({ success: true, message: "Đã lưu thông tin chữ ký", data });
  },

  updatePrintSettings: async (req: any, res: any) => {
    const data = await companyService.updatePrintSettings(req.body, req.auth!.userId);
    res.json({ success: true, message: "Đã lưu cài đặt in ấn", data });
  },
};
