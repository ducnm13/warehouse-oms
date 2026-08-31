import { prisma } from "@challenge/database";

type InventoryQuery = { from: Date; toExclusive: Date; warehouseId?: number; search?: string; category?: string };
const inventoryFilters = (query: InventoryQuery) => {
  const clauses: string[] = [], params: unknown[] = [];
  if (query.warehouseId) { clauses.push("pw.warehouseId=?"); params.push(query.warehouseId); }
  if (query.category) { clauses.push("p.category=?"); params.push(query.category); }
  if (query.search) { clauses.push("(p.name LIKE ? OR pp.name LIKE ? OR pp.sku LIKE ?)"); const value = `%${query.search}%`; params.push(value, value, value); }
  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
};

export const reportingRepository = {
  inventorySummary(query: InventoryQuery) {
    const filter = inventoryFilters(query);
    return prisma.$queryRawUnsafe<any[]>(`SELECT pw.packagingId,pw.warehouseId,pp.sku,pp.name packagingName,pp.unit,p.name productName,p.category,w.name warehouseName,
      COALESCE(ob.quantity,0)+COALESCE(SUM(CASE WHEN l.occurredAt<? THEN CASE WHEN l.direction='IN' THEN l.quantity ELSE -l.quantity END ELSE 0 END),0) openingQuantity,
      COALESCE(SUM(CASE WHEN l.occurredAt>=? AND l.occurredAt<? AND l.direction='IN' THEN l.quantity ELSE 0 END),0) inboundQuantity,
      COALESCE(SUM(CASE WHEN l.occurredAt>=? AND l.occurredAt<? AND l.direction='OUT' THEN l.quantity ELSE 0 END),0) outboundQuantity,
      COALESCE(SUM(CASE WHEN l.occurredAt<? THEN CASE WHEN l.direction='IN' THEN l.totalValue ELSE -l.totalValue END ELSE 0 END),0) openingValue,
      COALESCE(SUM(CASE WHEN l.occurredAt>=? AND l.occurredAt<? AND l.direction='IN' THEN l.totalValue ELSE 0 END),0) inboundValue,
      COALESCE(SUM(CASE WHEN l.occurredAt>=? AND l.occurredAt<? AND l.direction='OUT' THEN l.totalValue ELSE 0 END),0) outboundValue,
      COALESCE(ob.quantity,0) openingBaselineQuantity,pw.stock_quantity projectionQuantity
      FROM productwarehouses pw JOIN productpackagings pp ON pp.id=pw.packagingId JOIN products p ON p.id=pp.productId JOIN warehouses w ON w.id=pw.warehouseId
      LEFT JOIN inventory_ledger_opening_balances ob ON ob.packagingId=pw.packagingId AND ob.warehouseId=pw.warehouseId
      LEFT JOIN inventory_ledger l ON l.packagingId=pw.packagingId AND l.warehouseId=pw.warehouseId AND l.occurredAt<?
      ${filter.sql} GROUP BY pw.packagingId,pw.warehouseId,pp.sku,pp.name,pp.unit,p.name,p.category,w.name,ob.quantity,pw.stock_quantity ORDER BY p.name,pp.name,w.name`,
      query.from, query.from, query.toExclusive, query.from, query.toExclusive, query.from, query.from, query.toExclusive, query.from, query.toExclusive, query.toExclusive, ...filter.params);
  },
  itemLedger(query: { from: Date; toExclusive: Date; packagingId: number; warehouseId?: number }) {
    return prisma.$queryRawUnsafe<any[]>(`SELECT l.id,l.occurredAt,l.documentCode,l.sourceType,l.sourceId,l.direction,l.quantity,l.unitCost,l.totalValue,l.warehouseId,w.name warehouseName
      FROM inventory_ledger l JOIN warehouses w ON w.id=l.warehouseId
      WHERE l.packagingId=? AND l.occurredAt>=? AND l.occurredAt<? ${query.warehouseId ? "AND l.warehouseId=?" : ""}
      ORDER BY l.occurredAt,l.id`, query.packagingId, query.from, query.toExclusive, ...(query.warehouseId ? [query.warehouseId] : []));
  },
  itemOpening(query: { from: Date; packagingId: number; warehouseId?: number }) {
    const warehouseFilter = query.warehouseId ? " AND warehouseId=?" : "";
    const args = [query.packagingId, ...(query.warehouseId ? [query.warehouseId] : []), query.packagingId, query.from, ...(query.warehouseId ? [query.warehouseId] : [])];
    return prisma.$queryRawUnsafe<any[]>(`SELECT
      COALESCE((SELECT SUM(quantity) FROM inventory_ledger_opening_balances WHERE packagingId=?${warehouseFilter}),0)+
      COALESCE((SELECT SUM(CASE WHEN direction='IN' THEN quantity ELSE -quantity END) FROM inventory_ledger WHERE packagingId=? AND occurredAt<?${warehouseFilter}),0) quantity,
      COALESCE((SELECT SUM(CASE WHEN direction='IN' THEN totalValue ELSE -totalValue END) FROM inventory_ledger WHERE packagingId=? AND occurredAt<?${warehouseFilter}),0) totalValue,
      COALESCE((SELECT SUM(quantity) FROM inventory_ledger_opening_balances WHERE packagingId=?${warehouseFilter}),0) baselineQuantity`,
      ...args, query.packagingId, query.from, ...(query.warehouseId ? [query.warehouseId] : []), query.packagingId, ...(query.warehouseId ? [query.warehouseId] : []));
  },
  packaging(id: number) { return prisma.productpackagings.findUnique({ where: { id }, include: { products: true } }); },
  salesProfit(query: { from: string; to: string; warehouseId?: number; customerId?: number; search?: string }) {
    const clauses = ["so.status='FULFILLED'", "so.orderDate>=?", "so.orderDate<=?"], params: unknown[] = [query.from, query.to];
    if (query.warehouseId) { clauses.push("so.warehouseId=?"); params.push(query.warehouseId); }
    if (query.customerId) { clauses.push("so.customerId=?"); params.push(query.customerId); }
    if (query.search) { clauses.push("(so.code LIKE ? OR c.name LIKE ?)"); const value = `%${query.search}%`; params.push(value, value); }
    return prisma.$queryRawUnsafe<any[]>(`SELECT so.id,so.code,so.orderDate,so.customerId,c.code customerCode,c.name customerName,so.warehouseId,w.name warehouseName,
      COALESCE(SUM(sod.quantity*sod.unitPrice),0) grossSales,COALESCE(SUM(sod.quantity*sod.unitPrice-sod.lineTotal),0) discountAmount,
      COALESCE(SUM(sod.lineTotal),0) netRevenue,COALESCE(SUM(sod.costAmount),0) cogs,so.taxAmount
      FROM sales_orders so JOIN customers c ON c.id=so.customerId JOIN warehouses w ON w.id=so.warehouseId JOIN sales_order_details sod ON sod.orderId=so.id
      WHERE ${clauses.join(" AND ")} GROUP BY so.id,so.code,so.orderDate,so.customerId,c.code,c.name,so.warehouseId,w.name,so.taxAmount ORDER BY so.orderDate,so.id`, ...params);
  },
  production(query: { from: Date; toExclusive: Date; warehouseId?: number; search?: string }) {
    return prisma.productionorders.findMany({ where: { sourceModule: "PRODUCTION_V1", status: "COMPLETED", completedAt: { gte: query.from, lt: query.toExclusive }, ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}), ...(query.search ? { OR: [{ code: { contains: query.search } }, { batch_number: { contains: query.search } }] } : {}) }, include: { products: true, productiondetails: true, production_order_materials_v1: true }, orderBy: [{ completedAt: "asc" }, { id: "asc" }] });
  },
  assembly(query: { from: Date; toExclusive: Date; warehouseId?: number; search?: string }) {
    return prisma.assembly_orders.findMany({ where: { sourceModule: "ASSEMBLY_V1", status: "POSTED", postedAt: { gte: query.from, lt: query.toExclusive }, ...(query.warehouseId ? { OR: [{ componentWarehouseId: query.warehouseId }, { outputWarehouseId: query.warehouseId }] } : {}), ...(query.search ? { code: { contains: query.search } } : {}) }, include: { output: { include: { products: true } }, lines: true }, orderBy: [{ postedAt: "asc" }, { id: "asc" }] });
  },
  disassembly(query: { from: Date; toExclusive: Date; warehouseId?: number; search?: string }) {
    return prisma.disassembly_orders.findMany({ where: { sourceModule: "DISASSEMBLY_V1", status: "POSTED", postedAt: { gte: query.from, lt: query.toExclusive }, ...(query.warehouseId ? { OR: [{ sourceWarehouseId: query.warehouseId }, { recoveryWarehouseId: query.warehouseId }] } : {}), ...(query.search ? { code: { contains: query.search } } : {}) }, include: { source: { include: { products: true } }, lines: true }, orderBy: [{ postedAt: "asc" }, { id: "asc" }] });
  },
};