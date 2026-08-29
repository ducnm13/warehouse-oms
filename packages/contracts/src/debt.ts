import { z } from "zod";

const allocationSchema = z.object({
  documentId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive().max(999999999999),
});

const uniqueAllocations = (value: { allocations: Array<{ documentId: number }> }, context: z.RefinementCtx) => {
  const seen = new Set<number>();
  value.allocations.forEach((allocation, index) => {
    if (seen.has(allocation.documentId)) context.addIssue({ code: "custom", path: ["allocations", index, "documentId"], message: "Một chứng từ không được phân bổ nhiều dòng" });
    seen.add(allocation.documentId);
  });
};

const paymentBase = z.object({
  partnerId: z.coerce.number().int().positive(),
  paymentDate: z.iso.date(),
  method: z.enum(["CASH", "BANK", "OTHER"]),
  amount: z.coerce.number().positive().max(999999999999),
  note: z.string().trim().max(500).optional().default(""),
  allocations: z.array(allocationSchema).min(1).max(200),
}).superRefine(uniqueAllocations);

export const debtPaymentDraftSchema = paymentBase.superRefine((value, context) => {
  const allocated = value.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  if (Math.abs(allocated - value.amount) > 0.005) context.addIssue({ code: "custom", path: ["amount"], message: "Tổng phân bổ phải bằng số tiền phiếu" });
});
export const debtPaymentUpdateSchema = debtPaymentDraftSchema.safeExtend({ version: z.coerce.number().int().positive() });
export const debtActionSchema = z.object({ version: z.coerce.number().int().positive() });
export const debtCancelSchema = debtActionSchema.extend({ reason: z.string().trim().min(3).max(500) });
export const debtPaymentListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["DRAFT", "POSTED", "CANCELLED"]).optional(), search: z.string().trim().max(255).optional(),
  partnerId: z.coerce.number().int().positive().optional(),
});
export const debtAgingQuerySchema = z.object({
  search: z.string().trim().max(255).optional(), partnerId: z.coerce.number().int().positive().optional(),
  asOf: z.iso.date().optional(),
});

export type DebtPaymentDraftInput = z.infer<typeof debtPaymentDraftSchema>;
export type DebtPaymentUpdateInput = z.infer<typeof debtPaymentUpdateSchema>;
export type DebtCancelInput = z.infer<typeof debtCancelSchema>;