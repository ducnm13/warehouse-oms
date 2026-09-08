import { prisma } from "@challenge/database";

const packagingInclude = {
  products: { select: { id: true, name: true, category: true, sku: true } },
  prices: true,
  barcodes: true,
  productwarehouses: { select: { warehouseId: true, stock_quantity: true, warehouses: { select: { id: true, name: true } } } },
  warehouse: { select: { id: true, name: true } },
} as const;

const productInclude = {
  productpackagings: { where: { isActive: 1 }, include: packagingInclude },
  defaultWarehouse: { select: { id: true, name: true } },
} as const;

export const catalogRepository = {
  listProducts: (where: object, skip: number, take: number) =>
    prisma.products.findMany({ where, skip, take, orderBy: { name: "asc" }, include: productInclude }),

  countProducts: (where: object) => prisma.products.count({ where }),

  findProductById: (id: number) => prisma.products.findUnique({ where: { id }, include: productInclude }),

  updateProduct: (id: number, data: object) =>
    prisma.products.update({ where: { id }, data: { ...data, updatedAt: new Date().toISOString() } }),

  findPackagingById: (id: number) =>
    prisma.productpackagings.findUnique({ where: { id }, include: packagingInclude }),

  updatePackaging: (id: number, data: object) =>
    prisma.productpackagings.update({ where: { id }, data: { ...data, updatedAt: new Date().toISOString() } }),

  // Prices — dùng packagingId_priceType theo Prisma generated convention
  upsertPrice: (packagingId: number, priceType: string, price: number) =>
    prisma.product_prices.upsert({
      where: { packagingId_priceType: { packagingId, priceType } },
      create: { packagingId, priceType, price, isActive: 1 },
      update: { price },
    }),

  listWarehouses: () => prisma.warehouses.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
};
