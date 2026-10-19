import type { Request, Response } from "express";
import type { ProductionDeleteInput } from "@challenge/contracts";
import { productionService } from "./production.service";
const id=(r:Request)=>Number(r.params.id), user=(r:Request)=>{if(!r.auth)throw Error("Auth middleware missing");return r.auth.userId};
export const productionController={
  async list(req:Request,res:Response){const x=await productionService.list(req.query);res.json({success:true,message:"Lấy lệnh sản xuất thành công",data:x.data,meta:x.meta})},
  async get(req:Request,res:Response){res.json({success:true,message:"Lấy lệnh sản xuất thành công",data:await productionService.get(id(req))})},
  async create(req:Request,res:Response){res.status(201).json({success:true,message:"Đã lưu nháp lệnh sản xuất",data:await productionService.create(req.body,user(req))})},
  async update(req:Request,res:Response){res.json({success:true,message:"Đã cập nhật lệnh sản xuất",data:await productionService.update(id(req),req.body,user(req))})},
  async confirm(req:Request,res:Response){res.json({success:true,message:"Đã xác nhận sản xuất",data:await productionService.confirm(id(req),req.body,user(req))})},
  async complete(req:Request,res:Response){res.json({success:true,message:"Đã hoàn thành và ghi sổ sản xuất",data:await productionService.complete(id(req),req.body,user(req))})},
  async cancel(req:Request,res:Response){res.json({success:true,message:"Đã hủy lệnh sản xuất",data:await productionService.cancel(id(req),req.body,user(req))})},
  async delete(req:Request<Record<string, string>, unknown, ProductionDeleteInput>,res:Response){res.json({success:true,message:"Đã xóa lệnh sản xuất",data:await productionService.delete(id(req),req.body,user(req))})},
  async linkInventory(req:Request,res:Response){res.json({success:true,message:"Đã liên kết phiếu kho với lệnh sản xuất",data:await productionService.linkInventory(id(req),req.body,user(req))})},
  async syncMaterials(req:Request,res:Response){res.json({success:true,message:"Đã đồng bộ nguyên vật liệu từ phiếu xuất kho",data:await productionService.syncMaterials(id(req),user(req))})},
};