import { Prisma, prisma } from "@challenge/database";

export const productionInclude = {
  products: true,
  productiondetails: { include: { productpackagings: true }, orderBy: { id: "asc" as const } },
  production_order_materials_v1: { include: { productpackagings: { include: { products: true } } }, orderBy: { id: "asc" as const } },
  production_order_document_links_v1: true,
} satisfies Prisma.productionordersInclude;

export const productionRepository = {
  list(where: Prisma.productionordersWhereInput, skip: number, take: number) { return prisma.productionorders.findMany({ where, include: productionInclude, orderBy: [{ order_date: "desc" }, { id: "desc" }], skip, take }); },
  count(where: Prisma.productionordersWhereInput) { return prisma.productionorders.count({ where }); },
  find(id: number) { return prisma.productionorders.findUnique({ where: { id }, include: productionInclude }); },
};
export { prisma, Prisma };