import { Prisma, prisma } from "@challenge/database";

export const purchaseInclude = {
  suppliers: true,
  users: true,
  purchase_document_details: {
    include: { productpackagings: { include: { products: true } }, warehouses: true },
    orderBy: { id: "asc" as const },
  },
  purchase_document_links_v1: true,
} satisfies Prisma.purchase_documentsInclude;

export const purchaseRepository = {
  list(where: Prisma.purchase_documentsWhereInput, skip: number, take: number) {
    return prisma.purchase_documents.findMany({ where, include: purchaseInclude, orderBy: [{ documentDate: "desc" }, { id: "desc" }], skip, take });
  },
  count(where: Prisma.purchase_documentsWhereInput) { return prisma.purchase_documents.count({ where }); },
  findById(id: number) { return prisma.purchase_documents.findUnique({ where: { id }, include: purchaseInclude }); },
  supplierExists(id: number) { return prisma.suppliers.findUnique({ where: { id }, select: { id: true, name: true, paymentTermDays: true } }); },
  async validateReferences(lines: Array<{ packagingId: number; warehouseId?: number | null }>) {
    const packagingIds = [...new Set(lines.map(line => line.packagingId))];
    const warehouseIds = [...new Set(lines.map(line => line.warehouseId).filter(Boolean) as number[])];
    const [packagings, warehouses] = await Promise.all([
      prisma.productpackagings.findMany({ where: { id: { in: packagingIds } }, select: { id: true } }),
      prisma.warehouses.findMany({ where: { id: { in: warehouseIds } }, select: { id: true } }),
    ]);
    return { packagingIds: new Set(packagings.map(x => x.id)), warehouseIds: new Set(warehouses.map(x => x.id)) };
  },
  create(data: Prisma.purchase_documentsCreateInput) { return prisma.purchase_documents.create({ data, include: purchaseInclude }); },
};

export { prisma, Prisma };