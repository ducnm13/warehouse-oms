import { iamService } from "./iam.service";

export const iamController = {
  async listPermissions(_req: any, res: any) {
    res.json({ success: true, message: "OK", data: await iamService.listPermissions() });
  },

  async listRoles(_req: any, res: any) {
    res.json({ success: true, message: "OK", data: await iamService.listRoles() });
  },

  async getRole(req: any, res: any) {
    res.json({ success: true, message: "OK", data: await iamService.getRole(Number(req.params.id)) });
  },

  async createRole(req: any, res: any) {
    res.status(201).json({ success: true, message: "Đã tạo vai trò", data: await iamService.createRole(req.body) });
  },

  async updateRole(req: any, res: any) {
    res.json({ success: true, message: "Đã cập nhật vai trò", data: await iamService.updateRole(Number(req.params.id), req.body) });
  },

  async deleteRole(req: any, res: any) {
    await iamService.deleteRole(Number(req.params.id));
    res.json({ success: true, message: "Đã xóa vai trò", data: null });
  },

  async assignUserRoles(req: any, res: any) {
    res.json({
      success: true,
      message: "Đã gán vai trò cho tài khoản",
      data: await iamService.assignUserRoles(Number(req.params.id), req.body.roleIds),
    });
  },
};
