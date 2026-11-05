import { Prisma, prisma } from "@challenge/database";

export const salesInclude = {
  customers: true,
  warehouses: true,
  users_sales_orders_createdByTousers: true,
  users_sales_orders_approvedByTousers: true,
  sales_order_details: {
    include: { productpackagings: { include: { products: true } } },
    orderBy: { id: "asc" as const },
  },
  sales_document_links_v1: true,
} satisfies Prisma.sales_ordersInclude;

export const salesRepository = {
  list(where: Prisma.sales_ordersWhereInput, skip: number, take: number) {
    return prisma.sales_orders.findMany({ where, include: salesInclude, orderBy: [{ orderDate: "desc" }, { id: "desc" }], skip, take });
  },
  count(where: Prisma.sales_ordersWhereInput) { return prisma.sales_orders.count({ where }); },
  findById(id: number) { return prisma.sales_orders.findUnique({ where: { id }, include: salesInclude }); },
  customerExists(id: number) { return prisma.customers.findUnique({ where: { id }, select: { id: true, name: true } }); },
  warehouseExists(id: number) { return prisma.warehouses.findUnique({ where: { id }, select: { id: true } }); },
  async packagingIds(ids: number[]) {
    const rows = await prisma.productpackagings.findMany({ where: { id: { in: ids } }, select: { id: true } });
    return new Set(rows.map(row => row.id));
  },
  packagingPrices(ids: number[], customerId?: number) {
    return prisma.product_prices.findMany({
      where: { packagingId: { in: ids }, isActive: 1 },
      select: { packagingId: true, priceType: true, price: true },
    });
  },
  packagingPricesByType(ids: number[], priceType: string) {
    return prisma.product_prices.findMany({
      where: { packagingId: { in: ids }, isActive: 1, priceType },
      select: { packagingId: true, priceType: true, price: true },
    });
  },
  suggestions(customerId: number | undefined, search: string | undefined, limit: number) {
    const conditions = [
      "so.deletedAt IS NULL",
      "so.status = 'FULFILLED'",
      "d.lineType = 'SALE'",
      "pp.deletedAt IS NULL",
    ];
    const params: any[] = [];
    if (customerId) {
      conditions.push("so.customerId = ?");
      params.push(customerId);
    }
    if (search) {
      conditions.push("(pp.name LIKE ? OR pp.sku LIKE ? OR p.name LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    params.push(limit);
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT d.packagingId, pp.name, pp.sku, pp.unit, p.name AS productName,
        CAST(COUNT(DISTINCT d.orderId) AS SIGNED) AS times,
        CAST(COALESCE(SUM(d.quantity), 0) AS DECIMAL(18,4)) AS totalQuantity,
        CAST(SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(d.unitPrice, 0) ORDER BY so.orderDate DESC, so.id DESC), ',', 1) AS DECIMAL(18,4)) AS lastPrice,
        CAST(COALESCE(MAX(st.stockQuantity), 0) AS DECIMAL(18,4)) AS stockQuantity
      FROM sales_order_details d
      JOIN sales_orders so ON so.id = d.orderId
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