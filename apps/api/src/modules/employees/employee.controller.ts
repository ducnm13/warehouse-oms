import { employeeService } from "./employee.service";

export const employeeController = {
  list: async (req: any, res: any) => {
    const data = await employeeService.list(req.query as any);
    res.json({ success: true, message: "OK", ...data });
  },

  get: async (req: any, res: any) => {
    const data = await employeeService.get(Number(req.params.id));
    res.json({ success: true, message: "OK", data });
  },

  create: async (req: any, res: any) => {
    const data = await employeeService.create(req.body);
    res.status(201).json({ success: true, message: "Đã thêm nhân viên", data });
  },

  update: async (req: any, res: any) => {
    const data = await employeeService.update(Number(req.params.id), req.body);
    res.json({ success: true, message: "Đã cập nhật nhân viên", data });
  },

  delete: async (req: any, res: any) => {
    await employeeService.delete(Number(req.params.id));
    res.json({ success: true, message: "Đã xóa nhân viên", data: null });
  },
};
