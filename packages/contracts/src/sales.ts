import { z } from "zod";

export const salesLineSchema = z.object({
  packagingId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive().max(999999999),
  unitPrice: z.coerce.number().min(0).max(999999999999),
  discountRate: z.coerce.number().min(0).max(100).default(0),
  note: z.string().trim().max(500).optional().default(""),
});

export const salesDraftSchema = z.object({
  orderDate: z.iso.date(),
  deliveryDate: z.union([z.iso.date(), z.literal("")]).optional(),
  dueDate: z.union([z.iso.date(), z.literal("")]).optional(),
  customerId: z.coerce.number().int().positive(),
  warehouseId: z.coerce.number().int().positive(),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  paymentIntent: z.enum(["UNPAID", "PAID"]).default("UNPAID"),
  paymentMethod: z.enum(["CASH", "BANK"]).default("CASH"),
  note: z.string().trim().max(1000).optional().default(""),
  details: z.array(salesLineSchema).min(1).max(500),
}).superRefine((value, context) => {
  const seen = new Set<number>();
  value.details.forEach((line, index) => {
    if (seen.has(line.packagingId)) context.addIssue({
      code: "custom", path: ["details", index, "packagingId"], message: "Một quy cách không được nhập nhiều dòng",
    });
    seen.add(line.packagingId);
  });
});

export const salesUpdateSchema = salesDraftSchema.extend({ version: z.coerce.number().int().positive() });
export const salesActionSchema = z.object({ version: z.coerce.number().int().positive() });
export const salesRejectSchema = salesActionSchema.extend({ reason: z.string().trim().min(3).max(500) });
export const salesCancelSchema = salesRejectSchema;
export const salesPaymentSchema = salesActionSchema.extend({
  amount: z.coerce.number().positive().max(999999999999),
  paymentDate: z.iso.date(),
  method: z.enum(["CASH", "BANK"]),
  note: z.string().trim().max(500).optional().default(""),
});
export const salesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(),
  status: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED", "POSTED", "CANCELLED"]).optional(),
});

export type SalesDraftInput = z.infer<typeof salesDraftSchema>;
export type SalesUpdateInput = z.infer<typeof salesUpdateSchema>;
export type SalesRejectInput = z.infer<typeof salesRejectSchema>;
export type SalesCancelInput = z.infer<typeof salesCancelSchema>;
export type SalesPaymentInput = z.infer<typeof salesPaymentSchema>;