import { prisma } from "@challenge/database";

const packagingInclude = {
  products: { select: { id: true, name: true, category: true, sku: true } },
  prices: true,
  barcodes: true,
  productwarehouses: { select: { warehouseId: true, stock_quantity: true, warehouses: { select: { id: true, name: true } } } },
  warehouse: { select: { id: true, name: true } },
} as const;

export const productInclude = {
  productpackagings: { where: { deletedAt: null }, include: packagingInclude },
  defaultWarehouse: { select: { id: true, name: true } },
} as const;

export const catalogRepository = {
  listProducts: (where: object, skip: number, take: number) =>
    prisma.products.findMany({ where, skip, take, orderBy: { name: "asc" }, include: productInclude }),

  countProducts: (where: object) => prisma.products.count({ where }),

  findProductById: (id: number) => prisma.products.findUnique({ where: { id }, include: productInclude }),

  createProduct: (data: {
    name: string; sku?: string | null; category: string;
    description?: string | null; primaryUnit: string;
    defaultWarehouseId?: number | null; vatRate: number;
    canManageInventory: number; canBePurchased: number;
    canBeSold: number; canBeProduced: number; canBeBomComponent: number;
  }) => prisma.products.create({ data: { ...data, isActive: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, include: productInclude }),

  updateProduct: (id: number, data: object) =>
    prisma.products.update({ where: { id }, data: { ...data, updatedAt: new Date().toISOString() } }),

  toggleProductActive: (id: number, isActive: number) =>
    prisma.products.update({ where: { id }, data: { isActive, updatedAt: new Date().toISOString() } }),

  findPackagingById: (id: number) =>
    prisma.productpackagings.findUnique({ where: { id }, include: packagingInclude }),

  createPackaging: (data: {
    productId: number; name: string; sku?: string | null; unit: string;
    packCount: number; netWeight: number; shelfLifeMonths: number;
    min_stock: number; warehouseId?: number | null; barcode?: string | null;
    isActive: number;
  }) => prisma.productpackagings.create({ data: { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, include: packagingInclude }),

  updatePackaging: (id: number, data: object) =>
    prisma.productpackagings.update({ where: { id }, data: { ...data, updatedAt: new Date().toISOString() } }),

  softDeletePackaging: (id: number) =>
    prisma.productpackagings.update({ where: { id }, data: { isActive: 0, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }),

  // Prices
  upsertPrice: (packagingId: number, priceType: string, price: number) =>
    prisma.product_prices.upsert({
      where: { packagingId_priceType: { packagingId, priceType } },
      create: { packagingId, priceType, price, isActive: 1 },
      update: { price },
    }),

  listWarehouses: () => prisma.warehouses.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),

  // Low-stock packagings (tồn < min_stock)
  listLowStock: () => prisma.$queryRaw<any[]>`
    SELECT pp.id, pp.name packagingName, pp.sku, pp.unit, pp.min_stock,
           p.name productName, p.category,
           COALESCE(SUM(pw.stock_quantity),0) stockQty
    FROM productpackagings pp
    JOIN products p ON p.id = pp.productId
    LEFT JOIN productwarehouses pw ON pw.packagingId = pp.id
    WHERE pp.isActive = 1 AND pp.deletedAt IS NULL AND pp.min_stock > 0
    GROUP BY pp.id, pp.name, pp.sku, pp.unit, pp.min_stock, p.name, p.category
    HAVING COALESCE(SUM(pw.stock_quantity),0) < pp.min_stock
    ORDER BY stockQty ASC
    LIMIT 50
  `,
};
