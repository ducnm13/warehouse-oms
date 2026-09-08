import { Prisma, prisma } from "@challenge/database";

export const salesReturnInclude = {
  originalSalesOrder: { include: { customers: true } }, warehouse: true,
  lines: { include: { packaging: { include: { products: true } }, originalSalesOrderLine: true }, orderBy: { id: "asc" as const } },
  links: true,
} satisfies Prisma.sales_returnsInclude;

export const salesReturnRepository = {
  list(where: Prisma.sales_returnsWhereInput, skip: number, take: number) { return prisma.sales_returns.findMany({ where, include: salesReturnInclude, orderBy: [{ returnDate: "desc" }, { id: "desc" }], skip, take }); },
  count(where: Prisma.sales_returnsWhereInput) { return prisma.sales_returns.count({ where }); },
  find(id: number) { return prisma.sales_returns.findUnique({ where: { id }, include: salesReturnInclude }); },
  sale(id: number) { return prisma.sales_orders.findUnique({ where: { id }, include: { sales_order_details: { include: { productpackagings: { include: { products: true } } } }, customers: true } }); },
  warehouse(id: number) { return prisma.warehouses.findUnique({ where: { id }, select: { id: true } }); },
};
export { prisma, Prisma };