import type { Request, Response } from "express";
import type {
  TechnicalIncidentActionInput,
  TechnicalIncidentInput,
  TechnicalIncidentUpdateInput,
} from "@challenge/contracts";
import { technicalIncidentService } from "./technical-incident.service";

const id = (req: Request) => Number(req.params.id);
const user = (req: Request) => {
  if (!req.auth) throw new Error("Auth middleware missing");
  return req.auth.userId;
};

export const technicalIncidentController = {
  async list(req: Request, res: Response) {
    const result = await technicalIncidentService.list(req.query as any);
    res.json({
      success: true,
      message: "Lấy danh sách sự cố kỹ thuật thành công",
      data: result.data,
      meta: result.meta,
    });
  },

  async get(req: Request, res: Response) {
    res.json({
      success: true,
      message: "Lấy chi tiết sự cố kỹ thuật thành công",
      data: await technicalIncidentService.get(id(req)),
    });
  },

  async summary(_req: Request, res: Response) {
    res.json({
      success: true,
      message: "OK",
      data: await technicalIncidentService.summary(),
    });
  },

  async assignees(_req: Request, res: Response) {
    res.json({
      success: true,
      message: "OK",
      data: await technicalIncidentService.assignees(),
    });
  },

  async create(
    req: Request<Record<string, string>, unknown, TechnicalIncidentInput>,
    res: Response,
  ) {
    res.status(201).json({
      success: true,
      message: "Đã tạo sự cố kỹ thuật",
      data: await technicalIncidentService.create(req.body, user(req)),
    });
  },

  async update(
    req: Request<Record<string, string>, unknown, TechnicalIncidentUpdateInput>,
    res: Response,
  ) {
    res.json({
      success: true,
      message: "Đã cập nhật sự cố kỹ thuật",
      data: await technicalIncidentService.update(id(req), req.body, user(req)),
    });
  },

  async changeStatus(
    req: Request<Record<string, string>, unknown, TechnicalIncidentActionInput>,
    res: Response,
  ) {
    res.json({
      success: true,
      message: "Đã chuyển trạng thái sự cố",
      data: await technicalIncidentService.changeStatus(id(req), req.body, user(req)),
    });
  },

  async remove(req: Request, res: Response) {
    await technicalIncidentService.remove(id(req), Number(req.body?.version), user(req));
    res.json({ success: true, message: "Đã xóa sự cố kỹ thuật", data: null });
  },
};
