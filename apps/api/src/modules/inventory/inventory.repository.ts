import { Prisma, prisma } from "@challenge/database";

export const inventoryInclude = {
  warehouses: true,
  users: true,
  inventorytransactiondetails: {
    include: { productpackagings: { include: { products: true } } },
    orderBy: { id: "asc" as const },
  },
} satisfies Prisma.inventorytransactionsInclude;

export const stocktakeInclude = {
  warehouses: true,
  users: true,
  stocktake_details: {
    include: { productpackagings: { include: { products: true } } },
    orderBy: { id: "asc" as const },
  },
  stocktake_document_links_v1: true,
} satisfies Prisma.stocktakesInclude;

export const inventoryRepository = {
  list(where: Prisma.inventorytransactionsWhereInput, skip: number, take: number) {
    return prisma.inventorytransactions.findMany({ where, include: inventoryInclude, orderBy: [{ transaction_date: "desc" }, { id: "desc" }], skip, take });
  },
  count(where: Prisma.inventorytransactionsWhereInput) { return prisma.inventorytransactions.count({ where }); },
  findById(id: number) { return prisma.inventorytransactions.findUnique({ where: { id }, include: inventoryInclude }); },
  stocktakeList(where: Prisma.stocktakesWhereInput, skip: number, take: number) {
    return prisma.stocktakes.findMany({ where, include: stocktakeInclude, orderBy: [{ date: "desc" }, { id: "desc" }], skip, take });
  },
  stocktakeCount(where: Prisma.stocktakesWhereInput) { return prisma.stocktakes.count({ where }); },
  stocktakeById(id: number) { return prisma.stocktakes.findUnique({ where: { id }, include: stocktakeInclude }); },
  warehouse(id: number) { return prisma.warehouses.findUnique({ where: { id }, select: { id: true, name: true } }); },
  async packagingIds(ids: number[]) {
    const rows = await prisma.productpackagings.findMany({ where: { id: { in: ids } }, select: { id: true } });
    return new Set(rows.map(row => row.id));
  },
};

export { prisma, Prisma };