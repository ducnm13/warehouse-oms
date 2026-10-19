import { Prisma, prisma } from "@challenge/database";

export const bomInclude = { output: { include: { products: true } }, lines: { include: { component: { include: { products: true } } }, orderBy: { id: "asc" as const } } } satisfies Prisma.assembly_bom_headersInclude;
export const assemblyInclude = {
  output: { include: { products: true } }, componentWarehouse: true, outputWarehouse: true,
  lines: { include: { component: { include: { products: true } } }, orderBy: { id: "asc" as const } }, links: true,
} satisfies Prisma.assembly_ordersInclude;
export const disassemblyInclude = {
  source: { include: { products: true } }, sourceWarehouse: true, recoveryWarehouse: true,
  lines: { include: { component: { include: { products: true } } }, orderBy: { id: "asc" as const } }, links: true,
} satisfies Prisma.disassembly_ordersInclude;
export const assemblyOutputsInclude = {
  output: { include: { products: true } },
} satisfies Prisma.assembly_order_outputsInclude;
export const disassemblySourcesInclude = {
  source: { include: { products: true } },
} satisfies Prisma.disassembly_order_sourcesInclude;

const withOutputs = async (rows: any[], table: "assembly_order_outputs" | "disassembly_order_sources") => {
  const ids = rows.map(row => row.id);
  if (!ids.length) return rows;
  const placeholders = ids.map(() => "?").join(",");
  const children: any[] = table === "assembly_order_outputs"
    ? await prisma.$queryRawUnsafe(
      `SELECT o.id, o.orderId, o.plannedQuantity, o.actualQuantity, o.unitCost, o.totalValue, o.note,
              p.id packagingId, p.name packagingName, p.sku, p.unit, pr.name productName
       FROM assembly_order_outputs o JOIN productpackagings p ON p.id = o.outputPackagingId
       LEFT JOIN products pr ON pr.id = p.productId WHERE o.orderId IN (${placeholders}) ORDER BY o.id ASC`,
      ...ids,
    )
    : await prisma.$queryRawUnsafe(
      `SELECT o.id, o.orderId, o.plannedQuantity, o.actualQuantity, o.unitCost, o.totalValue, o.note,
              p.id packagingId, p.name packagingName, p.sku, p.unit, pr.name productName
       FROM disassembly_order_sources o JOIN productpackagings p ON p.id = o.sourcePackagingId
       LEFT JOIN products pr ON pr.id = p.productId WHERE o.orderId IN (${placeholders}) ORDER BY o.id ASC`,
      ...ids,
    );
  const grouped = new Map<number, any[]>();
  for (const child of children) {
    const list = grouped.get(Number(child.orderId)) || [];
    list.push(child);
    grouped.set(Number(child.orderId), list);
  }
  return rows.map(row => ({ ...row, ...(table === "assembly_order_outputs" ? { outputs: grouped.get(row.id) || [] } : { sources: grouped.get(row.id) || [] }) }));
};

const ASSEMBLY_SELECT = `
  o.id, o.code, o.orderDate, o.sourceModule, o.status, o.note, o.version,
  o.postedAt, o.cancelledAt, o.cancelReason, o.createdAt, o.updatedAt,
  o.outputPackagingId, o.plannedQuantity, o.actualQuantity,
  o.componentWarehouseId, o.outputWarehouseId,
  o.bomCode, o.bomVersion, o.assemblyCost, o.outputUnitCost, o.outputTotalValue,
  o.createdBy, o.postedBy, o.cancelledBy,
  p.id outPackagingId, p.name outPackagingName, p.sku outSku, p.unit outUnit, pr.name outProductName,
  cw.name componentWarehouseName, ow.name outputWarehouseName
`;
const DISASSEMBLY_SELECT = `
  o.id, o.code, o.orderDate, o.sourceModule, o.status, o.note, o.version,
  o.postedAt, o.cancelledAt, o.cancelReason, o.createdAt, o.updatedAt,
  o.sourcePackagingId AS outputPackagingId, o.plannedQuantity, o.actualQuantity,
  o.sourceWarehouseId AS componentWarehouseId, o.recoveryWarehouseId AS outputWarehouseId,
  o.bomCode, o.bomVersion, 0 AS assemblyCost, o.sourceUnitCost AS outputUnitCost, o.sourceTotalValue AS outputTotalValue,
  o.createdBy, o.postedBy, o.cancelledBy,
  p.id outPackagingId, p.name outPackagingName, p.sku outSku, p.unit outUnit, pr.name outProductName,
  sw.name componentWarehouseName, rw.name outputWarehouseName
`;

const buildOrderWhere = (where: any, table: "assembly_orders" | "disassembly_orders") => {
  const clauses: string[] = [];
  const params: any[] = [];
  const prefix = table === "assembly_orders" ? "o.sourceModule = 'ASSEMBLY_V1'" : "o.sourceModule = 'DISASSEMBLY_V1'";
  clauses.push(prefix);
  if (where?.status) { clauses.push("o.status = ?"); params.push(where.status); }
  if (where?.orderDate?.gte) { clauses.push("o.orderDate >= ?"); params.push(where.orderDate.gte); }
  if (where?.orderDate?.lt) { clauses.push("o.orderDate < ?"); params.push(where.orderDate.lt); }
  if (where?.OR) {
    clauses.push("(o.code LIKE ? OR o.bomCode LIKE ?)");
    const search = `%${where.OR[0]?.code?.contains || ""}%`;
    params.push(search, search);
  }
  return { clauses, params };
};

const withOrderDetails = async (rows: any[], table: "assembly_orders" | "disassembly_orders") => {
  const ids = rows.map(row => row.id);
  if (!ids.length) return rows;
  const placeholders = ids.map(() => "?").join(",");
  const lineTable = table === "assembly_orders" ? "assembly_order_lines" : "disassembly_order_lines";
  const linkTable = table === "assembly_orders" ? "assembly_order_document_links" : "disassembly_order_document_links";
  const lines: any[] = await prisma.$queryRawUnsafe(
    `SELECT l.*, p.name componentName, p.sku componentSku, p.unit componentUnit, pr.name componentProductName
     FROM ${lineTable} l JOIN productpackagings p ON p.id = l.componentPackagingId
     LEFT JOIN products pr ON pr.id = p.productId WHERE l.orderId IN (${placeholders}) ORDER BY l.id ASC`,
    ...ids,
  );
  const links: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM ${linkTable} WHERE orderId IN (${placeholders}) ORDER BY id ASC`,
    ...ids,
  );
  const groupedLines = new Map<number, any[]>();
  const groupedLinks = new Map<number, any[]>();
  for (const line of lines) {
    const list = groupedLines.get(Number(line.orderId)) || [];
    list.push({
      ...line,
      component: { id: line.componentPackagingId, name: line.componentName, sku: line.componentSku, unit: line.componentUnit, products: { name: line.componentProductName } },
    });
    groupedLines.set(Number(line.orderId), list);
  }
  for (const link of links) {
    const list = groupedLinks.get(Number(link.orderId)) || [];
    list.push(link);
    groupedLinks.set(Number(link.orderId), list);
  }
  const merged = await withOutputs(rows.map(row => ({ ...row, id: Number(row.id) })), table === "assembly_orders" ? "assembly_order_outputs" : "disassembly_order_sources");
  return merged.map((row: any) => ({
    ...row,
    output: row.outPackagingId ? { id: row.outPackagingId, name: row.outPackagingName, sku: row.outSku, unit: row.outUnit, products: { name: row.outProductName } } : null,
    source: row.outPackagingId ? { id: row.outPackagingId, name: row.outPackagingName, sku: row.outSku, unit: row.outUnit, products: { name: row.outProductName } } : null,
    componentWarehouse: row.componentWarehouseName ? { name: row.componentWarehouseName } : null,
    outputWarehouse: row.outputWarehouseName ? { name: row.outputWarehouseName } : null,
    sourceWarehouse: row.sourceWarehouseName ? { name: row.sourceWarehouseName } : null,
    recoveryWarehouse: row.recoveryWarehouseName ? { name: row.recoveryWarehouseName } : null,
    lines: groupedLines.get(Number(row.id)) || [],
    links: groupedLinks.get(Number(row.id)) || [],
  }));
};

const orderJoins = (table: "assembly_orders" | "disassembly_orders") => table === "assembly_orders"
  ? `LEFT JOIN productpackagings p ON p.id = o.outputPackagingId
     LEFT JOIN products pr ON pr.id = p.productId
     LEFT JOIN warehouses cw ON cw.id = o.componentWarehouseId
     LEFT JOIN warehouses ow ON ow.id = o.outputWarehouseId`
  : `LEFT JOIN productpackagings p ON p.id = o.sourcePackagingId
     LEFT JOIN products pr ON pr.id = p.productId
     LEFT JOIN warehouses sw ON sw.id = o.sourceWarehouseId
     LEFT JOIN warehouses rw ON rw.id = o.recoveryWarehouseId`;

const listOrders = async (table: "assembly_orders" | "disassembly_orders", where: any, skip: number, take: number): Promise<any[]> => {
  const { clauses, params } = buildOrderWhere(where, table);
  const select = table === "assembly_orders" ? ASSEMBLY_SELECT : DISASSEMBLY_SELECT;
  return prisma.$queryRawUnsafe(
    `SELECT ${select}
     FROM ${table} o
     ${orderJoins(table)}
     WHERE ${clauses.join(" AND ")} ORDER BY o.orderDate DESC, o.id DESC LIMIT ${Number(take)} OFFSET ${Number(skip)}`,
    ...params,
  );
};

const countOrders = async (table: "assembly_orders" | "disassembly_orders", where: any) => {
  const { clauses, params } = buildOrderWhere(where, table);
  const rows: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) total FROM ${table} o WHERE ${clauses.join(" AND ")}`, ...params);
  return Number(rows[0]?.total || 0);
};

const findOrder = async (table: "assembly_orders" | "disassembly_orders", id: number) => {
  const select = table === "assembly_orders" ? ASSEMBLY_SELECT : DISASSEMBLY_SELECT;
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT ${select}
     FROM ${table} o
     ${orderJoins(table)}
     WHERE o.id = ? LIMIT 1`,
    id,
  );
  if (!rows.length) return null;
  const [merged] = await withOrderDetails(rows, table);
  return merged;
};

export const assemblyRepository = {
  listBoms(where: Prisma.assembly_bom_headersWhereInput) { return prisma.assembly_bom_headers.findMany({ where, include: bomInclude, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] }); },
  findBom(id: number) { return prisma.assembly_bom_headers.findUnique({ where: { id }, include: bomInclude }); },
  async listAssembly(where: Prisma.assembly_ordersWhereInput, skip: number, take: number) {
    const rows: any[] = await listOrders("assembly_orders", where, skip, take);
    return withOrderDetails(rows, "assembly_orders");
  },
  countAssembly(where: Prisma.assembly_ordersWhereInput) { return countOrders("assembly_orders", where); },
  findAssembly(id: number) { return findOrder("assembly_orders", id); },
  async listDisassembly(where: Prisma.disassembly_ordersWhereInput, skip: number, take: number) {
    const rows: any[] = await listOrders("disassembly_orders", where, skip, take);
    return withOrderDetails(rows, "disassembly_orders");
  },
  countDisassembly(where: Prisma.disassembly_ordersWhereInput) { return countOrders("disassembly_orders", where); },
  findDisassembly(id: number) { return findOrder("disassembly_orders", id); },
};
export { Prisma, prisma };