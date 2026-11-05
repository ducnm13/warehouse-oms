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
  suggestions(supplierId: number | undefined, search: string | undefined, limit: number) {
    const conditions = [
      "pd.deletedAt IS NULL",
      "COALESCE(pd.documentStatus, 'POSTED') = 'POSTED'",
      "pp.deletedAt IS NULL",
    ];
    const params: any[] = [];
    if (supplierId) {
      conditions.push("pd.supplierId = ?");
      params.push(supplierId);
    }
    if (search) {
      conditions.push("(pp.name LIKE ? OR pp.sku LIKE ? OR p.name LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    params.push(limit);
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT d.packagingId, pp.name, pp.sku, pp.unit, p.name AS productName,
        CAST(COUNT(DISTINCT d.documentId) AS SIGNED) AS times,
        CAST(COALESCE(SUM(d.quantity), 0) AS DECIMAL(18,4)) AS totalQuantity,
        CAST(SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(d.unitPrice, 0) ORDER BY pd.documentDate DESC, pd.id DESC), ',', 1) AS DECIMAL(18,4)) AS lastPrice,
        CAST(COALESCE(MAX(st.stockQuantity), 0) AS DECIMAL(18,4)) AS stockQuantity
      FROM purchase_document_details d
      JOIN purchase_documents pd ON pd.id = d.documentId
      JOIN productpackagings pp ON pp.id = d.packagingId
      LEFT JOIN products p ON p.id = pp.productId
      LEFT JOIN (
        SELECT packagingId, SUM(COALESCE(stock_quantity, 0)) AS stockQuantity
        FROM productwarehouses GROUP BY packagingId
      ) st ON st.packagingId = pp.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY d.packagingId, pp.name, pp.sku, pp.unit, p.name
      ORDER BY times DESC, totalQuantity DESC, pp.name ASC
      LIMIT ?`,
      ...params,
    );
  },
};

export { prisma, Prisma };