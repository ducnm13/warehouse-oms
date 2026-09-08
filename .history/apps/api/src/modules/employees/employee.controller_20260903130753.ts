import type { RequestHandler } from "express";
import { employeeService } from "./employee.service";

export const employeeController = {
  list: (async (req, res) => {
    const data = await employeeService.list(req.query as any);
    res.json({ success: true, message: "OK", ...data });
  }) as RequestHandler,

  get: (async (req, res) => {
    const data = await employeeService.get(Number(req.params.id));
    res.json({ success: true, message: "OK", data });
  }) as RequestHandler,

  create: (async (req, res) => {
    const data = await employeeService.create(req.body);
    res.status(201).json({ success: true, message: "Đã thêm nhân viên", data });
  }) as RequestHandler,

  update: (async (req, res) => {
    const data = await employeeService.update(Number(req.params.id), req.body);
    res.json({ success: true, message: "Đã cập nhật nhân viên", data });
  }) as RequestHandler,

  delete: (async (req, res) => {
    await employeeService.delete(Number(req.params.id));
    res.json({ success: true, message: "Đã xóa nhân viên", data: null });
  }) as RequestHandler,
};
