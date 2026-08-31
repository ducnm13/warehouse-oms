import type { Request, Response } from "express";
import { assemblyService } from "./assembly.service";
const id = (req: Request) => Number(req.params.id);
const user = (req: Request) => { if (!req.auth) throw Error("Auth middleware missing"); return req.auth.userId; };
export const assemblyController = {
  async listBoms(req: Request, res: Response) { res.json({ success: true, message: "Lấy BOM lắp ráp thành công", data: await assemblyService.listBoms(req.query) }); },
  async getBom(req: Request, res: Response) { res.json({ success: true, message: "Lấy BOM thành công", data: await assemblyService.getBom(id(req)) }); },
  async createBom(req: Request, res: Response) { res.status(201).json({ success: true, message: "Đã tạo BOM lắp ráp", data: await assemblyService.createBom(req.body, user(req)) }); },
  async updateBom(req: Request, res: Response) { res.json({ success: true, message: "Đã cập nhật BOM lắp ráp", data: await assemblyService.updateBom(id(req), req.body, user(req)) }); },
  async listAssembly(req: Request, res: Response) { const result = await assemblyService.listAssembly(req.query); res.json({ success: true, message: "Lấy lệnh lắp ráp thành công", ...result }); },
  async getAssembly(req: Request, res: Response) { res.json({ success: true, message: "Lấy lệnh lắp ráp thành công", data: await assemblyService.getAssembly(id(req)) }); },
  async createAssembly(req: Request, res: Response) { res.status(201).json({ success: true, message: "Đã tạo lệnh lắp ráp", data: await assemblyService.createAssembly(req.body, user(req)) }); },
  async updateAssembly(req: Request, res: Response) { res.json({ success: true, message: "Đã cập nhật lệnh lắp ráp", data: await assemblyService.updateAssembly(id(req), req.body, user(req)) }); },
  async postAssembly(req: Request, res: Response) { res.json({ success: true, message: "Đã ghi sổ lắp ráp", data: await assemblyService.postAssembly(id(req), req.body, user(req)) }); },
  async cancelAssembly(req: Request, res: Response) { res.json({ success: true, message: "Đã hủy lệnh lắp ráp", data: await assemblyService.cancel("ASSEMBLY", id(req), req.body, user(req)) }); },
  async listDisassembly(req: Request, res: Response) { const result = await assemblyService.listDisassembly(req.query); res.json({ success: true, message: "Lấy lệnh tháo dỡ thành công", ...result }); },
  async getDisassembly(req: Request, res: Response) { res.json({ success: true, message: "Lấy lệnh tháo dỡ thành công", data: await assemblyService.getDisassembly(id(req)) }); },
  async createDisassembly(req: Request, res: Response) { res.status(201).json({ success: true, message: "Đã tạo lệnh tháo dỡ", data: await assemblyService.createDisassembly(req.body, user(req)) }); },
  async updateDisassembly(req: Request, res: Response) { res.json({ success: true, message: "Đã cập nhật lệnh tháo dỡ", data: await assemblyService.updateDisassembly(id(req), req.body, user(req)) }); },
  async postDisassembly(req: Request, res: Response) { res.json({ success: true, message: "Đã ghi sổ tháo dỡ", data: await assemblyService.postDisassembly(id(req), req.body, user(req)) }); },
  async cancelDisassembly(req: Request, res: Response) { res.json({ success: true, message: "Đã hủy lệnh tháo dỡ", data: await assemblyService.cancel("DISASSEMBLY", id(req), req.body, user(req)) }); },
};