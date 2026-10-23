import { z } from "zod";

const returnLineSchema = z.object({ originalSalesOrderLineId: z.coerce.number().int().positive(), quantity: z.coerce.number().positive().max(999999999), note: z.string().trim().max(500).optional().default("") });
export const salesReturnDraftSchema = z.object({
  originalSalesOrderId: z.coerce.number().int().positive(),
  warehouseId: z.coerce.number().int().positive(),
  returnDate: z.iso.date(),
  reason: z.string().trim().min(3).max(500),
  settlementType: z.literal("REDUCE_DEBT").default("REDUCE_DEBT"),
  lines: z.array(returnLineSchema).max(500),
}).superRefine((value,context)=>{const seen=new Set<number>();value.lines.forEach((line,index)=>{if(seen.has(line.originalSalesOrderLineId))context.addIssue({code:"custom",path:["lines",index,"originalSalesOrderLineId"],message:"Một dòng bán không được trả nhiều lần trong cùng phiếu"});seen.add(line.originalSalesOrderLineId)})});
export const salesReturnUpdateSchema = salesReturnDraftSchema.extend({ version: z.coerce.number().int().positive() });
export const salesReturnActionSchema = z.object({ version: z.coerce.number().int().positive() });
export const salesReturnCancelSchema = salesReturnActionSchema.extend({ reason: z.string().trim().min(3).max(500) });
export const salesReturnListQuerySchema = z.object({ page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(20),search:z.string().trim().max(255).optional(),status:z.enum(["DRAFT","POSTED","CANCELLED"]).optional(),originalSalesOrderId:z.coerce.number().int().positive().optional() });
export type SalesReturnDraftInput=z.infer<typeof salesReturnDraftSchema>;export type SalesReturnUpdateInput=z.infer<typeof salesReturnUpdateSchema>;export type SalesReturnCancelInput=z.infer<typeof salesReturnCancelSchema>;