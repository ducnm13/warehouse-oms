import { prisma } from "@challenge/database";

const linesInclude = {
  lines: {
    include: {
      packaging: { select: { id: true, name: true, sku: true, unit: true, products: { select: { id: true, name: true, category: true } } } },
    },
  },
} as const;

export const openingInventoryRepository = {
  list: (where: object, skip: number, take: number) =>
    prisma.opening_inventory_documents.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { warehouse: { select: { id: true, name: true } } },
    }),

  count: (where: object) => prisma.opening_inventory_documents.count({ where }),

  findById: (id: number) =>
    prisma.opening_inventory_documents.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, name: true } },
        ...linesInclude,
      },
    }),

  warehouseExists: (id: number) => prisma.warehouses.findUnique({ where: { id } }),

  packagingIds: async (ids: number[]) => {
    const rows = await prisma.productpackagings.findMany({ where: { id: { in: ids }, isActive: 1 }, select: { id: true } });
    return new Set(rows.map(r => r.id));
  },
};
