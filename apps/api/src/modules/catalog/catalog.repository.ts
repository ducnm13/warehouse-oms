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

  findProductBySku: (sku: string) => prisma.products.findFirst({ where: { sku } }),

  findPackagingBySku: (sku: string) => prisma.productpackagings.findFirst({ where: { sku, deletedAt: null } }),

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

  replaceBom: async (productPackagingId: number, materials: Array<{ materialPackagingId: number; quantity: number; unit?: string }>) => {
    await prisma.$executeRawUnsafe("DELETE FROM product_boms WHERE productPackagingId = ?", productPackagingId);
    for (const item of materials) {
      await prisma.$executeRawUnsafe(
        "INSERT INTO product_boms (productPackagingId, materialPackagingId, quantity, unit) VALUES (?, ?, ?, ?)",
        productPackagingId,
        item.materialPackagingId,
        item.quantity,
        item.unit || "kg",
      );
    }
    return prisma.$queryRawUnsafe(
      `SELECT b.id, b.productPackagingId, b.materialPackagingId, b.quantity, b.unit,
              p.name materialName, p.sku materialSku, p.unit materialUnit
       FROM product_boms b
       LEFT JOIN productpackagings p ON p.id = b.materialPackagingId
       WHERE b.productPackagingId = ?
       ORDER BY b.id ASC`,
      productPackagingId,
    );
  },

  // Prices
  upsertPrice: (packagingId: number, priceType: string, price: number) =>
    prisma.product_prices.upsert({
      where: { packagingId_priceType: { packagingId, priceType } },
      create: { packagingId, priceType, price, isActive: 1 },
      update: { price },
    }),

  listWarehouses: () => prisma.warehouses.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),

  // Low-stock packagings (tồn < min_stock)
  listCostPrices: () =>
    prisma.product_prices.findMany({
      where: { priceType: "COST", isActive: 1 },
      select: { packagingId: true, price: true },
    }),

  listRetailPrices: () =>
    prisma.product_prices.findMany({
      where: { priceType: "SALE_3", isActive: 1 },
      select: { packagingId: true, price: true },
    }),

  listBomByOutput: (productPackagingId: number) =>
    prisma.$queryRawUnsafe(
      `SELECT b.id, b.productPackagingId, b.materialPackagingId, b.quantity, b.unit,
              p.name materialName, p.sku materialSku, p.unit materialUnit
       FROM product_boms b
       LEFT JOIN productpackagings p ON p.id = b.materialPackagingId
       WHERE b.productPackagingId = ?
       ORDER BY b.id ASC`,
      productPackagingId,
    ),

  listPackagings: (where: object, take: number) =>
    prisma.productpackagings.findMany({
      where: { deletedAt: null, ...where },
      take,
      orderBy: { name: "asc" },
      include: {
        products: { select: { id: true, name: true, category: true, sku: true } },
        warehouse: { select: { id: true, name: true } },
      },
    }),

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

  listGroupPrices: () =>
    prisma.customer_group_prices.findMany({
      include: { customerGroup: { select: { id: true, code: true, name: true } } },
      orderBy: { customerGroup: { displayOrder: "asc" } },
    }),

  upsertGroupPrice: (input: { customerGroupId: number; priceType: string }) =>
    prisma.customer_group_prices.upsert({
      where: { customerGroupId: input.customerGroupId },
      create: { customerGroupId: input.customerGroupId, priceType: input.priceType },
      update: { priceType: input.priceType },
      include: { customerGroup: { select: { id: true, code: true, name: true } } },
    }),
};
