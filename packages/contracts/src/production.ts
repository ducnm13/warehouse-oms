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
  orderDate: z.iso.date(), mfgDate: z.iso.date(), expDate: z.iso.date(),
  warehouseId: z.coerce.number().int().positive(), productId: z.coerce.number().int().positive(),
  batchNumber: z.string().trim().min(1).max(255), totalPowderKg: z.coerce.number().min(0).max(999999999),
  targetSachets: z.coerce.number().int().min(0).max(999999999), lossPercent: z.coerce.number().min(0).max(100),
  outputs: z.array(outputSchema).min(1).max(100),
}).superRefine((value, context) => unique(value.outputs, context, "outputs"));
export const productionUpdateSchema = productionDraftSchema.safeExtend({ version: z.coerce.number().int().positive() });
export const productionActionSchema = z.object({ version: z.coerce.number().int().positive() });
export const productionCompleteSchema = productionActionSchema.extend({
  outputs: z.array(z.object({ detailId: z.coerce.number().int().positive(), actualQuantity: z.coerce.number().min(0).max(999999999), note: z.string().trim().max(500).optional().default("") })).min(1),
  materials: z.array(z.object({ materialId: z.coerce.number().int().positive(), actualQuantity: z.coerce.number().min(0).max(999999999) })).min(1),
});
export const productionCancelSchema = productionActionSchema.extend({ reason: z.string().trim().min(3).max(500) });
export const productionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(), status: z.enum(["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  warehouseId: z.coerce.number().int().positive().optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
export type ProductionDraftInput = z.infer<typeof productionDraftSchema>;
export type ProductionUpdateInput = z.infer<typeof productionUpdateSchema>;
export type ProductionCompleteInput = z.infer<typeof productionCompleteSchema>;
export type ProductionCancelInput = z.infer<typeof productionCancelSchema>;