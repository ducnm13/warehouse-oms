import { Prisma, prisma } from "@challenge/database";

export const promotionInclude = {
  conditions: { include: { packaging: { include: { products: true } } } },
  rewards: { include: { packaging: { include: { products: true } }, warehouse: true } },
} satisfies Prisma.promotion_programsInclude;

export const promotionRepository = {
  list(where: Prisma.promotion_programsWhereInput, skip: number, take: number) {
    return prisma.promotion_programs.findMany({ where, include: promotionInclude, orderBy: [{ priority: "desc" }, { id: "asc" }], skip, take });
  },
  count(where: Prisma.promotion_programsWhereInput) { return prisma.promotion_programs.count({ where }); },
  find(id: number) { return prisma.promotion_programs.findUnique({ where: { id }, include: promotionInclude }); },
  codeExists(code: string, excludeId?: number) { return prisma.promotion_programs.findFirst({ where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } }); },
  packaging(id: number) { return prisma.productpackagings.findUnique({ where: { id }, select: { id: true } }); },
  warehouse(id?: number) { return id ? prisma.warehouses.findUnique({ where: { id }, select: { id: true } }) : Promise.resolve({ id: 0 }); },
};

export { prisma };