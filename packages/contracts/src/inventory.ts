import { z } from "zod";

export const inventoryLineSchema = z.object({
  packagingId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive().max(999999999),
  unitCost: z.coerce.number().min(0).max(999999999999).default(0),
  note: z.string().trim().max(500).optional().default(""),
});

const uniqueLines = (value: { details: Array<{ packagingId: number }> }, context: z.RefinementCtx) => {
  const seen = new Set<number>();
  value.details.forEach((line, index) => {
    if (seen.has(line.packagingId)) context.addIssue({ code: "custom", path: ["details", index, "packagingId"], message: "Một quy cách không được nhập nhiều dòng" });
    seen.add(line.packagingId);
  });
};

export const inventoryDraftSchema = z.object({
  type: z.enum(["IMPORT", "EXPORT"]),
  transactionDate: z.iso.date(),
  warehouseId: z.coerce.number().int().positive(),
  recipient: z.string().trim().max(255).optional().default(""),
  reason: z.string().trim().max(500).optional().default(""),
  note: z.string().trim().max(1000).optional().default(""),
  details: z.array(inventoryLineSchema).min(1).max(500),
}).superRefine(uniqueLines);

export const inventoryUpdateSchema = inventoryDraftSchema.extend({ version: z.coerce.number().int().positive() });
export const inventoryActionSchema = z.object({ version: z.coerce.number().int().positive() });
export const inventoryCancelSchema = inventoryActionSchema.extend({ reason: z.string().trim().min(3).max(500) });
export const inventoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(),
  status: z.enum(["DRAFT", "POSTED", "CANCELLED"]).optional(),
  type: z.enum(["IMPORT", "EXPORT"]).optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
});

export const inventoryBalanceQuerySchema = z.object({
  warehouseId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(255).optional(),
});

export const stocktakeLineSchema = z.object({
  packagingId: z.coerce.number().int().positive(),
  actualQuantity: z.coerce.number().min(0).max(999999999),
});
export const stocktakeDraftSchema = z.object({
  date: z.iso.date(),
  warehouseId: z.coerce.number().int().positive(),
  note: z.string().trim().max(1000).optional().default(""),
  details: z.array(stocktakeLineSchema).min(1).max(2000),
}).superRefine(uniqueLines);
export const stocktakeUpdateSchema = stocktakeDraftSchema.extend({ version: z.coerce.number().int().positive() });
export const stocktakeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["DRAFT", "COMPLETED", "CANCELLED"]).optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
});

export type InventoryDraftInput = z.infer<typeof inventoryDraftSchema>;
export type InventoryUpdateInput = z.infer<typeof inventoryUpdateSchema>;
export type InventoryCancelInput = z.infer<typeof inventoryCancelSchema>;
export type StocktakeDraftInput = z.infer<typeof stocktakeDraftSchema>;
export type StocktakeUpdateInput = z.infer<typeof stocktakeUpdateSchema>;