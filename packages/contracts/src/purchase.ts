import { z } from "zod";

export const purchaseLineSchema = z.object({
  packagingId: z.coerce.number().int().positive(),
  warehouseId: z.coerce.number().int().positive().nullable().optional(),
  quantity: z.coerce.number().positive().max(999999999),
  unitPrice: z.coerce.number().min(0).max(999999999999),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  note: z.string().trim().max(500).optional().default(""),
});

export const purchaseDraftSchema = z.object({
  documentDate: z.iso.date(),
  dueDate: z.union([z.iso.date(), z.literal("")]).optional(),
  type: z.enum(["DOMESTIC_INVENTORY", "DOMESTIC_NO_INVENTORY"]),
  paymentIntent: z.enum(["UNPAID", "PAID"]).default("UNPAID"),
  paymentMethod: z.enum(["CASH", "BANK"]).default("CASH"),
  invoiceOption: z.enum(["WITH_INVOICE", "NO_INVOICE"]).default("WITH_INVOICE"),
  supplierId: z.coerce.number().int().positive(),
  deliveryPerson: z.string().trim().max(255).optional().default(""),
  buyerName: z.string().trim().max(255).optional().default(""),
  description: z.string().trim().max(1000).optional().default(""),
  purchaseCost: z.coerce.number().min(0).max(999999999999).default(0),
  details: z.array(purchaseLineSchema).min(1).max(500),
}).superRefine((value, context) => {
  if (value.type === "DOMESTIC_INVENTORY") value.details.forEach((line, index) => {
    if (!line.warehouseId) context.addIssue({ code: "custom", path: ["details", index, "warehouseId"], message: "Vui lòng chọn kho nhập" });
  });
});

export const purchaseUpdateSchema = purchaseDraftSchema.extend({
  version: z.coerce.number().int().positive(),
});

export const purchaseActionSchema = z.object({
  version: z.coerce.number().int().positive(),
});

export const purchaseCancelSchema = purchaseActionSchema.extend({
  reason: z.string().trim().min(3).max(500),
});

export const numericIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });

export const purchaseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(),
  status: z.enum(["DRAFT", "POSTED", "CANCELLED"]).optional(),
});

export type PurchaseDraftInput = z.infer<typeof purchaseDraftSchema>;
export type PurchaseUpdateInput = z.infer<typeof purchaseUpdateSchema>;
export type PurchaseCancelInput = z.infer<typeof purchaseCancelSchema>;