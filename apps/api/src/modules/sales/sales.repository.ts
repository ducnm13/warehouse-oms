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
};

export { prisma, Prisma };