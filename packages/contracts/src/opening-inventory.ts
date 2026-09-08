import { z } from "zod";

export const openingInventoryLineSchema = z.object({
  packagingId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive().max(999999999),
  unitCost: z.coerce.number().min(0).max(999999999999).default(0),
  batchNumber: z.string().trim().max(100).optional().nullable(),
  expiryDate: z.union([z.iso.date(), z.literal("")]).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const openingInventoryDraftSchema = z.object({
  documentDate: z.iso.date(),
  warehouseId: z.coerce.number().int().positive(),
  note: z.string().trim().max(500).optional().nullable(),
  lines: z.array(openingInventoryLineSchema).min(1).max(500),
});
export type OpeningInventoryDraftInput = z.infer<typeof openingInventoryDraftSchema>;

export const openingInventoryUpdateSchema = openingInventoryDraftSchema.extend({
  version: z.coerce.number().int().min(1),
});
export type OpeningInventoryUpdateInput = z.infer<typeof openingInventoryUpdateSchema>;

export const openingInventoryActionSchema = z.object({
  version: z.coerce.number().int().min(1),
});
export type OpeningInventoryActionInput = z.infer<typeof openingInventoryActionSchema>;

export const openingInventoryCancelSchema = z.object({
  version: z.coerce.number().int().min(1),
  reason: z.string().trim().min(1).max(500),
});
export type OpeningInventoryCancelInput = z.infer<typeof openingInventoryCancelSchema>;

export const openingInventoryListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.enum(["DRAFT", "POSTED", "CANCELLED"]).optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
});
export type OpeningInventoryListQuery = z.infer<typeof openingInventoryListQuerySchema>;
