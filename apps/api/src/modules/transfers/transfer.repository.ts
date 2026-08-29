import { Prisma, prisma } from "@challenge/database";

export const transferInclude = {
  warehouses_warehouse_transfers_fromWarehouseIdTowarehouses: true,
  warehouses_warehouse_transfers_toWarehouseIdTowarehouses: true,
  users: true,
  warehouse_transfer_details: {
    include: { productpackagings: { include: { products: true } } },
    orderBy: { id: "asc" as const },
  },
  warehouse_transfer_document_links_v1: true,
} satisfies Prisma.warehouse_transfersInclude;

export const transferRepository = {
  list(where: Prisma.warehouse_transfersWhereInput, skip: number, take: number) {
    return prisma.warehouse_transfers.findMany({ where, include: transferInclude, orderBy: [{ transferDate: "desc" }, { id: "desc" }], skip, take });
  },
  count(where: Prisma.warehouse_transfersWhereInput) { return prisma.warehouse_transfers.count({ where }); },
  findById(id: number) { return prisma.warehouse_transfers.findUnique({ where: { id }, include: transferInclude }); },
  async warehouses(ids: number[]) {
    const rows = await prisma.warehouses.findMany({ where: { id: { in: ids } }, select: { id: true } });
    return new Set(rows.map(row => row.id));
  },
  async packagingIds(ids: number[]) {
    const rows = await prisma.productpackagings.findMany({ where: { id: { in: ids } }, select: { id: true } });
    return new Set(rows.map(row => row.id));
  },
};

export { prisma, Prisma };