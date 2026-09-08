import { z } from "zod";

// ─── Product Prices ───────────────────────────────────────────────────────────
export const priceTypes = ["COST", "SALE_1", "SALE_2", "SALE_3"] as const;
export type PriceType = (typeof priceTypes)[number];

export const productPriceSchema = z.object({
  priceType: z.enum(priceTypes),
  price: z.coerce.number().min(0).max(999999999999),
});

// ─── Create Product ───────────────────────────────────────────────────────────
export const catalogProductCreateSchema = z.object({
  name: z.string().trim().min(1).max(500),
  sku: z.string().trim().max(255).optional().nullable(),
  category: z.enum(["PRODUCT", "MATERIAL", "PACKAGING", "SERVICE"]).default("PRODUCT"),
  description: z.string().trim().max(2000).optional().nullable(),
  primaryUnit: z.string().trim().min(1).max(50).default("Cái"),
  defaultWarehouseId: z.coerce.number().int().positive().optional().nullable(),
  vatRate: z.coerce.number().min(0).max(100).default(0),
  canManageInventory: z.boolean().default(true),
  canBePurchased: z.boolean().default(true),
  canBeSold: z.boolean().default(true),
  canBeProduced: z.boolean().default(false),
  canBeBomComponent: z.boolean().default(true),
  // Quy cách đầu tiên (bắt buộc)
  packaging: z.object({
    name: z.string().trim().min(1).max(500),
    sku: z.string().trim().max(255).optional().nullable(),
    unit: z.string().trim().min(1).max(50),
    packCount: z.coerce.number().int().min(1).default(1),
    netWeight: z.coerce.number().min(0).default(0),
    shelfLifeMonths: z.coerce.number().int().min(0).default(24),
    min_stock: z.coerce.number().int().min(0).default(0),
    warehouseId: z.coerce.number().int().positive().optional().nullable(),
    barcode: z.string().trim().max(100).optional().nullable(),
    prices: z.array(productPriceSchema).optional().default([]),
  }),
});
export type CatalogProductCreateInput = z.infer<typeof catalogProductCreateSchema>;

// ─── Create Packaging (thêm quy cách vào sản phẩm có sẵn) ───────────────────
export const catalogPackagingCreateSchema = z.object({
  productId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(500),
  sku: z.string().trim().max(255).optional().nullable(),
  unit: z.string().trim().min(1).max(50),
  packCount: z.coerce.number().int().min(1).default(1),
  netWeight: z.coerce.number().min(0).default(0),
  shelfLifeMonths: z.coerce.number().int().min(0).default(24),
  min_stock: z.coerce.number().int().min(0).default(0),
  warehouseId: z.coerce.number().int().positive().optional().nullable(),
  barcode: z.string().trim().max(100).optional().nullable(),
  prices: z.array(productPriceSchema).optional().default([]),
});
export type CatalogPackagingCreateInput = z.infer<typeof catalogPackagingCreateSchema>;

// ─── Product Flags (update) ───────────────────────────────────────────────────
export const catalogProductUpdateSchema = z.object({
  name: z.string().trim().min(1).max(500).optional(),
  sku: z.string().trim().max(255).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  primaryUnit: z.string().trim().min(1).max(50).default("Cái"),
  defaultWarehouseId: z.coerce.number().int().positive().optional().nullable(),
  vatRate: z.coerce.number().min(0).max(100).default(0),
  canManageInventory: z.boolean().default(true),
  canBePurchased: z.boolean().default(true),
  canBeSold: z.boolean().default(true),
  canBeProduced: z.boolean().default(false),
  canBeBomComponent: z.boolean().default(true),
  prices: z.array(productPriceSchema).optional().default([]),
});
export type CatalogProductUpdateInput = z.infer<typeof catalogProductUpdateSchema>;

// ─── Packaging (SKU) update ───────────────────────────────────────────────────
export const catalogPackagingUpdateSchema = z.object({
  name: z.string().trim().min(1).max(500),
  unit: z.string().trim().min(1).max(50),
  packCount: z.coerce.number().int().min(1).default(1),
  netWeight: z.coerce.number().min(0).max(999999).default(0),
  shelfLifeMonths: z.coerce.number().int().min(0).max(999).default(24),
  min_stock: z.coerce.number().int().min(0).default(0),
  warehouseId: z.coerce.number().int().positive().optional().nullable(),
  barcode: z.string().trim().max(100).optional().nullable(),
  isActive: z.boolean().default(true),
  prices: z.array(productPriceSchema).optional().default([]),
});
export type CatalogPackagingUpdateInput = z.infer<typeof catalogPackagingUpdateSchema>;

// ─── List Query ───────────────────────────────────────────────────────────────
export const catalogListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(50).optional(),
  isActive: z.coerce.number().int().optional(),
});
export type CatalogListQuery = z.infer<typeof catalogListQuerySchema>;
