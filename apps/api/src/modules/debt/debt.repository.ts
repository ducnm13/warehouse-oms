import { prisma } from "@challenge/database";

export const debtRepository = {
  customer(id: number) { return prisma.customers.findUnique({ where: { id }, select: { id: true, code: true, name: true } }); },
  supplier(id: number) { return prisma.suppliers.findUnique({ where: { id }, select: { id: true, code: true, name: true } }); },
};

export { prisma };