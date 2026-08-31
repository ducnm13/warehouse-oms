import type { Request, Response } from "express";
import { productionService } from "./production.service";
const id=(r:Request)=>Number(r.params.id), user=(r:Request)=>{if(!r.auth)throw Error("Auth middleware missing");return r.auth.userId};
export const productionController={
  async list(req:Request,res:Response){const x=await productionService.list(req.query);res.json({success:true,message:"Lấy lệnh sản xuất thành công",data:x.data,meta:x.meta})},
  async get(req:Request,res:Response){res.json({success:true,message:"Lấy lệnh sản xuất thành công",data:await productionService.get(id(req))})},
  async create(req:Request,res:Response){res.status(201).json({success:true,message:"Đã lưu nháp lệnh sản xuất",data:await productionService.create(req.body,user(req))})},
  async update(req:Request,res:Response){res.json({success:true,message:"Đã cập nhật lệnh sản xuất",data:await productionService.update(id(req),req.body,user(req))})},
  async start(req:Request,res:Response){res.json({success:true,message:"Đã bắt đầu sản xuất",data:await productionService.start(id(req),Number(req.body.version),user(req))})},
  async complete(req:Request,res:Response){res.json({success:true,message:"Đã hoàn thành và ghi sổ sản xuất",data:await productionService.complete(id(req),req.body,user(req))})},
  async cancel(req:Request,res:Response){res.json({success:true,message:"Đã hủy lệnh sản xuất",data:await productionService.cancel(id(req),req.body,user(req))})},
};