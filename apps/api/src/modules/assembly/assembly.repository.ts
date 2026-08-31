import { Prisma, prisma } from "@challenge/database";

export const bomInclude = { output: { include: { products: true } }, lines: { include: { component: { include: { products: true } } }, orderBy: { id: "asc" as const } } } satisfies Prisma.assembly_bom_headersInclude;
export const assemblyInclude = { output: { include: { products: true } }, componentWarehouse: true, outputWarehouse: true, lines: { include: { component: { include: { products: true } } }, orderBy: { id: "asc" as const } }, links: true } satisfies Prisma.assembly_ordersInclude;
export const disassemblyInclude = { source: { include: { products: true } }, sourceWarehouse: true, recoveryWarehouse: true, lines: { include: { component: { include: { products: true } } }, orderBy: { id: "asc" as const } }, links: true } satisfies Prisma.disassembly_ordersInclude;

export const assemblyRepository = {
  listBoms(where: Prisma.assembly_bom_headersWhereInput) { return prisma.assembly_bom_headers.findMany({ where, include: bomInclude, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] }); },
  findBom(id: number) { return prisma.assembly_bom_headers.findUnique({ where: { id }, include: bomInclude }); },
  listAssembly(where: Prisma.assembly_ordersWhereInput, skip: number, take: number) { return prisma.assembly_orders.findMany({ where, include: assemblyInclude, orderBy: [{ orderDate: "desc" }, { id: "desc" }], skip, take }); },
  countAssembly(where: Prisma.assembly_ordersWhereInput) { return prisma.assembly_orders.count({ where }); },
  findAssembly(id: number) { return prisma.assembly_orders.findUnique({ where: { id }, include: assemblyInclude }); },
  listDisassembly(where: Prisma.disassembly_ordersWhereInput, skip: number, take: number) { return prisma.disassembly_orders.findMany({ where, include: disassemblyInclude, orderBy: [{ orderDate: "desc" }, { id: "desc" }], skip, take }); },
  countDisassembly(where: Prisma.disassembly_ordersWhereInput) { return prisma.disassembly_orders.count({ where }); },
  findDisassembly(id: number) { return prisma.disassembly_orders.findUnique({ where: { id }, include: disassemblyInclude }); },
};
export { Prisma, prisma };