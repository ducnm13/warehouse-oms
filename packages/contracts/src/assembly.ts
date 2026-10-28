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

const orderBase = z.object({
  code: z.string().trim().max(20).optional().default(""),
  orderDate: z.iso.date(),
  note: z.string().trim().max(1000).optional().default(""),
});
const finishedLine = z.object({
  packagingId: positiveId,
  plannedQuantity: quantity,
  note: z.string().trim().max(500).optional().default(""),
});
export const assemblyDraftSchema = orderBase.extend({
  outputs: z.array(finishedLine).min(1).max(100),
  componentWarehouseId: positiveId,
  outputWarehouseId: positiveId,
  assemblyCost: z.coerce.number().min(0).max(999999999999).optional().default(0),
}).superRefine((value, ctx) => {
  const seen = new Set<number>();
  value.outputs.forEach((row, index) => {
    if (seen.has(row.packagingId)) ctx.addIssue({ code: "custom", path: ["outputs", index, "packagingId"], message: "Thành phẩm không được trùng" });
    seen.add(row.packagingId);
  });
});
export const assemblyUpdateSchema = assemblyDraftSchema.extend({ version: z.coerce.number().int().positive() });
export const disassemblyDraftSchema = orderBase.extend({
  outputs: z.array(finishedLine).min(1).max(100),
  sourceWarehouseId: positiveId,
  recoveryWarehouseId: positiveId,
}).superRefine((value, ctx) => {
  const seen = new Set<number>();
  value.outputs.forEach((row, index) => {
    if (seen.has(row.packagingId)) ctx.addIssue({ code: "custom", path: ["outputs", index, "packagingId"], message: "Thành phẩm không được trùng" });
    seen.add(row.packagingId);
  });
});
export const disassemblyUpdateSchema = disassemblyDraftSchema.extend({ version: z.coerce.number().int().positive() });
export const lifecycleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(), status: z.enum(["DRAFT", "POSTED", "COMPLETED", "CANCELLED"]).optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
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
export const assemblyDeleteSchema = z.object({ version: z.coerce.number().int().positive() });

export type AssemblyBomInput = z.infer<typeof assemblyBomInputSchema>;
export type AssemblyBomUpdateInput = z.infer<typeof assemblyBomUpdateSchema>;
export type AssemblyDraftInput = z.infer<typeof assemblyDraftSchema>;
export type AssemblyUpdateInput = z.infer<typeof assemblyUpdateSchema>;
export type AssemblyPostInput = z.infer<typeof assemblyPostSchema>;
export type DisassemblyDraftInput = z.infer<typeof disassemblyDraftSchema>;
export type DisassemblyUpdateInput = z.infer<typeof disassemblyUpdateSchema>;
export type DisassemblyPostInput = z.infer<typeof disassemblyPostSchema>;
export type AssemblyCancelInput = z.infer<typeof assemblyCancelSchema>;
export type AssemblyDeleteInput = z.infer<typeof assemblyDeleteSchema>;