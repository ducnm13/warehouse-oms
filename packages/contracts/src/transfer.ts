import { z } from "zod";

export const transferLineSchema = z.object({
  packagingId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive().max(999999999),
  note: z.string().trim().max(500).optional().default(""),
});

const validateTransfer = (value: { fromWarehouseId: number; toWarehouseId: number; details: Array<{ packagingId: number }> }, context: z.RefinementCtx) => {
  if (value.fromWarehouseId === value.toWarehouseId) context.addIssue({ code: "custom", path: ["toWarehouseId"], message: "Kho nguồn và kho đích phải khác nhau" });
  const seen = new Set<number>();
  value.details.forEach((line, index) => {
    if (seen.has(line.packagingId)) context.addIssue({ code: "custom", path: ["details", index, "packagingId"], message: "Một quy cách không được chuyển nhiều dòng" });
    seen.add(line.packagingId);
  });
};

export const transferDraftSchema = z.object({
  transferDate: z.iso.date(),
  fromWarehouseId: z.coerce.number().int().positive(),
  toWarehouseId: z.coerce.number().int().positive(),
  note: z.string().trim().max(1000).optional().default(""),
  details: z.array(transferLineSchema).min(1).max(500),
}).superRefine(validateTransfer);

export const transferUpdateSchema = transferDraftSchema.safeExtend({ version: z.coerce.number().int().positive() });
export const transferActionSchema = z.object({ version: z.coerce.number().int().positive() });
export const transferCancelSchema = transferActionSchema.extend({ reason: z.string().trim().min(3).max(500) });
export const transferListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(),
  status: z.enum(["DRAFT", "IN_TRANSIT", "RECEIVED", "CANCELLED"]).optional(),
  fromWarehouseId: z.coerce.number().int().positive().optional(),
  toWarehouseId: z.coerce.number().int().positive().optional(),
});

export type TransferDraftInput = z.infer<typeof transferDraftSchema>;
export type TransferUpdateInput = z.infer<typeof transferUpdateSchema>;
export type TransferCancelInput = z.infer<typeof transferCancelSchema>;