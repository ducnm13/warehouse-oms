import { z } from "zod";

const outputSchema = z.object({
  packagingId: z.coerce.number().int().positive(),
  plannedQuantity: z.coerce.number().positive().max(999999999),
  allocationPercent: z.coerce.number().min(0).max(100).default(0),
  note: z.string().trim().max(500).optional().default(""),
});
const unique = (rows: Array<{ packagingId: number }>, context: z.RefinementCtx, path: string) => {
  const seen = new Set<number>(); rows.forEach((row, index) => { if (seen.has(row.packagingId)) context.addIssue({ code: "custom", path: [path, index, "packagingId"], message: "Quy cách không được trùng" }); seen.add(row.packagingId); });
};
export const productionDraftSchema = z.object({
  code: z.string().trim().max(20).optional().default(""),
  orderDate: z.iso.date(), mfgDate: z.iso.date(), expDate: z.iso.date(),
  warehouseId: z.coerce.number().int().positive(),
  batchNumber: z.string().trim().max(255).optional().default(""), totalPowderKg: z.coerce.number().min(0).max(999999999),
  targetSachets: z.coerce.number().int().min(0).max(999999999), lossPercent: z.coerce.number().min(0).max(100),
  note: z.string().trim().max(1000).optional().default(""),
  outputs: z.array(outputSchema).min(1).max(100),
}).superRefine((value, context) => unique(value.outputs, context, "outputs"));
export const productionUpdateSchema = productionDraftSchema.safeExtend({ version: z.coerce.number().int().positive() });
export const productionActionSchema = z.object({ version: z.coerce.number().int().positive() });
export const productionConfirmSchema = productionActionSchema.extend({
  outputs: z.array(z.object({ detailId: z.coerce.number().int().positive(), allocationPercent: z.coerce.number().min(0).max(100) })).min(1),
}).superRefine((value, context) => {
  const total = value.outputs.reduce((sum, o) => sum + o.allocationPercent, 0);
  if (total > 0 && Math.abs(total - 100) > 0.01) {
    context.addIssue({ code: "custom", path: ["outputs"], message: "Tổng % phân bổ phải bằng 100%" });
  }
});
export const productionCompleteSchema = productionActionSchema.extend({
  // Mỗi dòng chốt hoặc trỏ dòng kế hoạch có sẵn (detailId) hoặc là SKU phân bổ thêm (packagingId)
  outputs: z.array(z.object({ detailId: z.coerce.number().int().positive().optional(), packagingId: z.coerce.number().int().positive().optional(), actualQuantity: z.coerce.number().min(0).max(999999999), note: z.string().trim().max(500).optional().default("") })).min(1),
  materials: z.array(z.object({ materialId: z.coerce.number().int().positive(), actualQuantity: z.coerce.number().min(0).max(999999999) })).optional().default([]),
}).superRefine((value, context) => {
  value.outputs.forEach((item, index) => {
    if (!!item.detailId === !!item.packagingId) {
      context.addIssue({ code: "custom", path: ["outputs", index], message: "Mỗi dòng cần detailId hoặc packagingId" });
    }
  });
});
export const productionCancelSchema = productionActionSchema.extend({ reason: z.string().trim().min(3).max(500) });
export const productionDeleteSchema = productionActionSchema;
export const productionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(), status: z.enum(["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  warehouseId: z.coerce.number().int().positive().optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type ProductionDraftInput = z.infer<typeof productionDraftSchema>;
export type ProductionUpdateInput = z.infer<typeof productionUpdateSchema>;
export type ProductionConfirmInput = z.infer<typeof productionConfirmSchema>;
export type ProductionCompleteInput = z.infer<typeof productionCompleteSchema>;
export type ProductionCancelInput = z.infer<typeof productionCancelSchema>;
export type ProductionDeleteInput = z.infer<typeof productionDeleteSchema>;