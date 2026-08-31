import { z } from "zod";

const positiveId = z.coerce.number().int().positive();
const quantity = z.coerce.number().positive().max(999999999);
const note = z.string().trim().max(500).optional().default("");
const uniqueComponents = (rows: Array<{ componentPackagingId: number }>, ctx: z.RefinementCtx) => {
  const seen = new Set<number>();
  rows.forEach((row, index) => {
    if (seen.has(row.componentPackagingId)) ctx.addIssue({ code: "custom", path: ["lines", index, "componentPackagingId"], message: "Linh kiện không được trùng" });
    seen.add(row.componentPackagingId);
  });
};

export const assemblyBomInputSchema = z.object({
  code: z.string().trim().min(1).max(100), outputPackagingId: positiveId,
  outputQuantity: quantity, status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"), note,
  lines: z.array(z.object({ componentPackagingId: positiveId, quantity, allocationWeight: z.coerce.number().min(0).max(999999999).default(0), note })).min(1).max(100),
}).superRefine((value, ctx) => {
  uniqueComponents(value.lines, ctx);
  value.lines.forEach((line, index) => { if (line.componentPackagingId === value.outputPackagingId) ctx.addIssue({ code: "custom", path: ["lines", index, "componentPackagingId"], message: "Output không thể là linh kiện của chính nó" }); });
});
export const assemblyBomUpdateSchema = assemblyBomInputSchema.safeExtend({ version: z.coerce.number().int().positive() });
export const assemblyBomListQuerySchema = z.object({ search: z.string().trim().max(255).optional(), status: z.enum(["ACTIVE", "INACTIVE"]).optional() });

const orderBase = z.object({ orderDate: z.iso.date(), plannedQuantity: quantity, note });
export const assemblyDraftSchema = orderBase.extend({ outputPackagingId: positiveId, componentWarehouseId: positiveId, outputWarehouseId: positiveId });
export const assemblyUpdateSchema = assemblyDraftSchema.extend({ version: z.coerce.number().int().positive() });
export const disassemblyDraftSchema = orderBase.extend({ sourcePackagingId: positiveId, sourceWarehouseId: positiveId, recoveryWarehouseId: positiveId });
export const disassemblyUpdateSchema = disassemblyDraftSchema.extend({ version: z.coerce.number().int().positive() });
export const lifecycleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(), status: z.enum(["DRAFT", "POSTED", "CANCELLED"]).optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
export const assemblyPostSchema = z.object({
  version: z.coerce.number().int().positive(), actualQuantity: quantity, assemblyCost: z.coerce.number().min(0).max(999999999999),
  lines: z.array(z.object({ lineId: positiveId, actualQuantity: z.coerce.number().min(0).max(999999999) })).min(1),
});
export const disassemblyPostSchema = z.object({
  version: z.coerce.number().int().positive(), actualQuantity: quantity,
  lines: z.array(z.object({ lineId: positiveId, actualQuantity: z.coerce.number().min(0).max(999999999), lossQuantity: z.coerce.number().min(0).max(999999999).default(0) })).min(1),
}).refine(value => value.lines.some(line => line.actualQuantity > 0), { path: ["lines"], message: "Phải có ít nhất một linh kiện thu hồi" });
export const assemblyCancelSchema = z.object({ version: z.coerce.number().int().positive(), reason: z.string().trim().min(3).max(500) });

export type AssemblyBomInput = z.infer<typeof assemblyBomInputSchema>;
export type AssemblyBomUpdateInput = z.infer<typeof assemblyBomUpdateSchema>;
export type AssemblyDraftInput = z.infer<typeof assemblyDraftSchema>;
export type AssemblyUpdateInput = z.infer<typeof assemblyUpdateSchema>;
export type AssemblyPostInput = z.infer<typeof assemblyPostSchema>;
export type DisassemblyDraftInput = z.infer<typeof disassemblyDraftSchema>;
export type DisassemblyUpdateInput = z.infer<typeof disassemblyUpdateSchema>;
export type DisassemblyPostInput = z.infer<typeof disassemblyPostSchema>;
export type AssemblyCancelInput = z.infer<typeof assemblyCancelSchema>;