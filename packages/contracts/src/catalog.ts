import { z } from "zod";

// ─── Common Params ─────────────────────────────────────────────────────────────
export const numericIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const priceBookItemParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  packagingId: z.coerce.number().int().positive(),
});

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

export const bomWeightUnits = ["kg", "g", "mg", "ton"] as const;
export type BomWeightUnit = (typeof bomWeightUnits)[number];

// ─── Replace BOM (định mức lắp ráp một mã từ nhiều mã khác) ───────────────
export const catalogBomReplaceSchema = z.object({
  productPackagingId: z.coerce.number().int().positive(),
  materials: z.array(z.object({
    materialPackagingId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().min(0.0001).max(1000000),
    unit: z.string().trim().min(1).max(50).optional().default("kg"),
  })).min(1).max(100),
});
export type CatalogBomReplaceInput = z.infer<typeof catalogBomReplaceSchema>;

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

// ─── Bulk Import ──────────────────────────────────────────────────────────────
export const catalogImportModes = ["ADD_NEW", "UPDATE", "OVERWRITE"] as const;
export type CatalogImportMode = (typeof catalogImportModes)[number];

export const catalogImportRowSchema = z.object({
  sku: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(500),
  category: z.enum(["PRODUCT", "MATERIAL", "PACKAGING", "SERVICE"]).optional().default("PRODUCT"),
  primaryUnit: z.string().trim().min(1).max(50).optional().default("Cái"),
  description: z.string().trim().max(2000).optional().nullable().default(null),
  defaultWarehouseId: z.coerce.number().int().positive().optional().nullable().default(null),
  vatRate: z.coerce.number().min(0).max(100).optional().default(0),
  barcode: z.string().trim().max(100).optional().nullable().default(null),
  min_stock: z.coerce.number().min(0).optional().default(0),
  packCount: z.coerce.number().int().min(1).optional().default(1),
  shelfLifeMonths: z.coerce.number().int().min(0).optional().default(24),
  priceCost: z.coerce.number().min(0).optional().default(0),
  priceSale1: z.coerce.number().min(0).optional().default(0),
  priceSale2: z.coerce.number().min(0).optional().default(0),
  priceSale3: z.coerce.number().min(0).optional().default(0),
});
export type CatalogImportRow = z.infer<typeof catalogImportRowSchema>;

export const catalogImportSchema = z.object({
  mode: z.enum(catalogImportModes).default("ADD_NEW"),
  rows: z.array(catalogImportRowSchema).min(1).max(5000),
});
export type CatalogImportInput = z.infer<typeof catalogImportSchema>;

// ─── List Query ───────────────────────────────────────────────────────────────
export const catalogListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(50),
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(50).optional(),
  isActive: z.coerce.number().int().optional(),
});
export type CatalogListQuery = z.infer<typeof catalogListQuerySchema>;

// ─── Customer Group Prices ───────────────────────────────────────────────────────
export const customerGroupPriceSchema = z.object({
  customerGroupId: z.coerce.number().int().positive(),
  priceType: z.enum(priceTypes),
});
export type CustomerGroupPriceInput = z.infer<typeof customerGroupPriceSchema>;

// ─── Price Books ───────────────────────────────────────────────────────────────
export const priceBookCreateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
});
export type PriceBookCreateInput = z.infer<typeof priceBookCreateSchema>;

export const priceBookUpdateSchema = z.object({
  code: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
});
export type PriceBookUpdateInput = z.infer<typeof priceBookUpdateSchema>;

export const priceBookItemSchema = z.object({
  packagingId: z.coerce.number().int().positive(),
  costPrice: z.coerce.number().min(0).max(999999999999).default(0),
  salePrice: z.coerce.number().min(0).max(999999999999).default(0),
  currency: z.string().default("VND"),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
});
export type PriceBookItemInput = z.infer<typeof priceBookItemSchema>;

// ─── Price Book Bulk Add ────────────────────────────────────────────────────────
export const priceBookBulkAddSchema = z.object({
  mode: z.enum(["ALL_FINISHED", "BY_CATEGORY"]),
  category: z.string().min(1, "Chọn nhóm sản phẩm").optional(),
  packagingIds: z.array(z.coerce.number().int().positive()).optional(),
}).refine(data => data.mode !== "BY_CATEGORY" || data.category, {
  message: "Chọn nhóm sản phẩm khi thêm theo nhóm",
  path: ["category"],
});
export type PriceBookBulkAddInput = z.infer<typeof priceBookBulkAddSchema>;

// ─── Warehouses ───────────────────────────────────────────────────────────────
export const warehouseTypeEnum = z.enum(["MAIN", "SUB", "RECEIVING", "SHIPPING", "PRODUCTION"]);
export type WarehouseType = z.infer<typeof warehouseTypeEnum>;

export const warehouseCreateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  type: warehouseTypeEnum.default("MAIN"),
  location: z.string().trim().max(500).optional().nullable(),
  address: z.string().trim().max(1000).optional().nullable(),
});
export type WarehouseCreateInput = z.infer<typeof warehouseCreateSchema>;

export const warehouseUpdateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  type: warehouseTypeEnum.default("MAIN"),
  location: z.string().trim().max(500).optional().nullable(),
  address: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
});
export type WarehouseUpdateInput = z.infer<typeof warehouseUpdateSchema>;
