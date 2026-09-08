import { prisma } from "@challenge/database";

export const openingInventoryRepository = {
  list: (where: object, skip: number, take: number) =>
    prisma.opening_inventory_documents.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { warehouses: { select: { id: true, name: true } } },
    }),

  count: (where: object) => prisma.opening_inventory_documents.count({ where }),

  findById: (id: number) =>
    prisma.opening_inventory_documents.findUnique({
      where: { id },
      include: {
        warehouses: { select: { id: true, name: true } },
        opening_inventory_lines: {
          include: { productpackagings: { select: { id: true, name: true, sku: true, unit: true, products: { select: { id: true, name: true, category: true } } } } },
        },
      },
    }),

  warehouseExists: (id: number) => prisma.warehouses.findUnique({ where: { id } }),

  packagingIds: async (ids: number[]) => {
    const rows = await prisma.productpackagings.findMany({ where: { id: { in: ids }, isActive: 1 }, select: { id: true } });
    return new Set(rows.map(r => r.id));
  },
};
