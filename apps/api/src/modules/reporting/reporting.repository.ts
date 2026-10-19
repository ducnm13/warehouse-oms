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
      COALESCE(SUM(sod.lineTotal),0)-COALESCE(ret.returnSubtotal,0) netRevenue,
      COALESCE(SUM(sod.costAmount),0)-COALESCE(ret.returnCost,0) cogs,so.taxAmount-COALESCE(ret.returnTax,0) taxAmount
      FROM sales_orders so JOIN customers c ON c.id=so.customerId JOIN warehouses w ON w.id=so.warehouseId JOIN sales_order_details sod ON sod.orderId=so.id
      LEFT JOIN (SELECT originalSalesOrderId,SUM(subtotal) returnSubtotal,SUM(taxAmount) returnTax,SUM(costAmount) returnCost FROM sales_returns WHERE status='POSTED' GROUP BY originalSalesOrderId) ret ON ret.originalSalesOrderId=so.id
      WHERE ${clauses.join(" AND ")} GROUP BY so.id,so.code,so.orderDate,so.customerId,c.code,c.name,so.warehouseId,w.name,so.taxAmount,ret.returnSubtotal,ret.returnTax,ret.returnCost ORDER BY so.orderDate,so.id`, ...params);
  },
  productionVariance(query: { from: Date; toExclusive: Date; warehouseId?: number; search?: string }) {
    const clauses = ["po.sourceModule='PRODUCTION_V1'", "po.status='COMPLETED'", "po.completedAt>=?", "po.completedAt<?"];
    const params: unknown[] = [query.from, query.toExclusive];
    if (query.warehouseId) { clauses.push("po.warehouseId=?"); params.push(query.warehouseId); }
    if (query.search) {
      clauses.push("(po.code LIKE ? OR p.name LIKE ? OR mp.name LIKE ? OR mpp.name LIKE ? OR mpp.sku LIKE ?)");
      const value = `%${query.search}%`; params.push(value, value, value, value, value);
    }
    return prisma.$queryRawUnsafe<any[]>(`SELECT po.id orderId,po.code,po.completedAt,po.warehouseId,w.name warehouseName,
      po.productId,p.name productName,COALESCE(NULLIF(po.target_sachets,0),outputs.plannedOutput,0) plannedOutput,COALESCE(outputs.actualOutput,0) actualOutput,
      pom.id materialId,pom.packagingId,mpp.sku,mpp.name packagingName,mpp.unit,mp.name materialName,
      pom.plannedQuantity,pom.actualQuantity,pom.unitCost,pom.totalValue
      FROM productionorders po
      JOIN products p ON p.id=po.productId JOIN warehouses w ON w.id=po.warehouseId
      JOIN production_order_materials_v1 pom ON pom.orderId=po.id
      JOIN productpackagings mpp ON mpp.id=pom.packagingId JOIN products mp ON mp.id=mpp.productId
      LEFT JOIN (SELECT pd.orderId,SUM(pd.quantity*COALESCE(pp.packCount,1)) plannedOutput,SUM(pd.actual_quantity*COALESCE(pp.packCount,1)) actualOutput FROM productiondetails pd JOIN productpackagings pp ON pp.id=pd.packagingId GROUP BY pd.orderId) outputs ON outputs.orderId=po.id
      WHERE ${clauses.join(" AND ")} ORDER BY po.completedAt,po.id,mp.name,mpp.name`, ...params);
  },
  salesByCustomer(query: { from: string; to: string; warehouseId?: number; groupId?: number; search?: string }) {
    const inner: string[] = ["so.status='FULFILLED'", "so.orderDate>=?", "so.orderDate<=?"], innerParams: unknown[] = [query.from, query.to];
    if (query.warehouseId) { inner.push("so.warehouseId=?"); innerParams.push(query.warehouseId); }
    const outer: string[] = [], outerParams: unknown[] = [];
    if (query.groupId) { outer.push("cg.id=?"); outerParams.push(query.groupId); }
    if (query.search) { outer.push("(c.name LIKE ? OR c.code LIKE ?)"); const value = `%${query.search}%`; outerParams.push(value, value); }
    return prisma.$queryRawUnsafe<any[]>(`SELECT c.id customerId, c.code customerCode, c.name customerName,
      cg.id groupId, cg.name groupName,
      COUNT(*) orders, SUM(o.grossSales) grossSales, SUM(o.discountAmount) discountAmount,
      SUM(o.lineTotal)-COALESCE(r.returnSubtotal,0) netRevenue,
      SUM(o.taxAmount)-COALESCE(r.returnTax,0) taxAmount,
      SUM(o.costAmount)-COALESCE(r.returnCost,0) cogs
      FROM customers c LEFT JOIN customer_groups cg ON cg.id=c.groupId
      JOIN (SELECT so.customerId, so.id orderId, so.taxAmount,
        SUM(sod.quantity*sod.unitPrice) grossSales,
        SUM(sod.quantity*sod.unitPrice-sod.lineTotal) discountAmount,
        SUM(sod.lineTotal) lineTotal, SUM(sod.costAmount) costAmount
        FROM sales_orders so JOIN sales_order_details sod ON sod.orderId=so.id
        WHERE ${inner.join(" AND ")} GROUP BY so.customerId, so.id, so.taxAmount) o ON o.customerId=c.id
      LEFT JOIN (SELECT customerId, SUM(subtotal) returnSubtotal, SUM(taxAmount) returnTax, SUM(costAmount) returnCost
        FROM sales_returns WHERE status='POSTED' GROUP BY customerId) r ON r.customerId=c.id
      ${outer.length ? `WHERE ${outer.join(" AND ")}` : ""}
      GROUP BY c.id, c.code, c.name, cg.id, cg.name, r.returnSubtotal, r.returnTax, r.returnCost
      ORDER BY netRevenue DESC`, ...innerParams, ...outerParams);
  },
  salesByProduct(query: { from: string; to: string; warehouseId?: number; search?: string }) {
    const clauses = ["so.status='FULFILLED'", "sod.lineType='SALE'", "so.orderDate>=?", "so.orderDate<=?"], params: unknown[] = [query.from, query.to];
    if (query.warehouseId) { clauses.push("so.warehouseId=?"); params.push(query.warehouseId); }
    if (query.search) { clauses.push("(p.name LIKE ? OR pp.name LIKE ? OR pp.sku LIKE ?)"); const value = `%${query.search}%`; params.push(value, value, value); }
    return prisma.$queryRawUnsafe<any[]>(`SELECT sod.packagingId, pp.sku, pp.name packagingName, pp.unit, p.name productName,
      SUM(sod.quantity) quantity, SUM(sod.quantity*sod.unitPrice) grossSales,
      SUM(sod.quantity*sod.unitPrice-sod.lineTotal) discountAmount,
      SUM(sod.lineTotal)-COALESCE(ret.returnTotal,0) netRevenue,
      SUM(sod.costAmount)-COALESCE(ret.returnCost,0) cogs
      FROM sales_order_details sod
      JOIN sales_orders so ON so.id=sod.orderId
      JOIN productpackagings pp ON pp.id=sod.packagingId
      JOIN products p ON p.id=pp.productId
      LEFT JOIN (SELECT srl.packagingId, SUM(srl.lineTotal) returnTotal, SUM(srl.costAmount) returnCost
        FROM sales_return_lines srl JOIN sales_returns sr ON sr.id=srl.salesReturnId
        WHERE sr.status='POSTED' GROUP BY srl.packagingId) ret ON ret.packagingId=sod.packagingId
      WHERE ${clauses.join(" AND ")}
      GROUP BY sod.packagingId, pp.sku, pp.name, pp.unit, p.name, ret.returnTotal, ret.returnCost
      ORDER BY netRevenue DESC`, ...params);
  },
  productionOverview(query: { from: Date; toExclusive: Date; warehouseId?: number; search?: string }) {
    const clauses = ["po.sourceModule='PRODUCTION_V1'", "po.status='COMPLETED'", "po.completedAt>=?", "po.completedAt<?"], params: unknown[] = [query.from, query.toExclusive];
    if (query.warehouseId) { clauses.push("po.warehouseId=?"); params.push(query.warehouseId); }
    if (query.search) { clauses.push("(po.code LIKE ? OR p.name LIKE ? OR pp.name LIKE ? OR pp.sku LIKE ?)"); const value = `%${query.search}%`; params.push(value, value, value, value); }
    return prisma.$queryRawUnsafe<any[]>(`SELECT pp.id packagingId, pp.sku, pp.name packagingName, pp.unit, p.name productName,
      COUNT(DISTINCT po.id) orders,
      SUM(pd.quantity) plannedPacks, SUM(pd.actual_quantity) actualPacks,
      SUM(CASE WHEN ordPlanned.totalPlanned>0 THEN po.total_powder_kg*pd.quantity/ordPlanned.totalPlanned ELSE 0 END) powderKg
      FROM productiondetails pd
      JOIN productionorders po ON po.id=pd.orderId
      JOIN productpackagings pp ON pp.id=pd.packagingId
      JOIN products p ON p.id=pp.productId
      JOIN (SELECT orderId, SUM(quantity) totalPlanned FROM productiondetails GROUP BY orderId) ordPlanned ON ordPlanned.orderId=po.id
      WHERE ${clauses.join(" AND ")}
      GROUP BY pp.id, pp.sku, pp.name, pp.unit, p.name ORDER BY actualPacks DESC`, ...params);
  },
  transfers(query: { from: string; to: string; warehouseId?: number; status?: string; search?: string }) {
    const clauses = ["t.transferDate>=?", "t.transferDate<=?"], params: unknown[] = [query.from, query.to];
    if (query.warehouseId) { clauses.push("(t.fromWarehouseId=? OR t.toWarehouseId=?)"); params.push(query.warehouseId, query.warehouseId); }
    if (query.status) { clauses.push("t.status=?"); params.push(query.status); }
    if (query.search) { clauses.push("(t.code LIKE ? OR t.note LIKE ?)"); const value = `%${query.search}%`; params.push(value, value); }
    return prisma.$queryRawUnsafe<any[]>(`SELECT t.id, t.code, t.transferDate, t.status, t.note,
      t.fromWarehouseId, fw.name fromWarehouseName, t.toWarehouseId, tw.name toWarehouseName,
      COUNT(td.id) lineCount, COALESCE(SUM(td.quantity),0) quantity
      FROM warehouse_transfers t
      JOIN warehouses fw ON fw.id=t.fromWarehouseId
      JOIN warehouses tw ON tw.id=t.toWarehouseId
      LEFT JOIN warehouse_transfer_details td ON td.transferId=t.id
      WHERE ${clauses.join(" AND ")}
      GROUP BY t.id, t.code, t.transferDate, t.status, t.note,
        t.fromWarehouseId, fw.name, t.toWarehouseId, tw.name
      ORDER BY t.transferDate DESC, t.id DESC LIMIT 500`, ...params);
  },
  purchasesBySupplier(query: { from: string; to: string; supplierId?: number; search?: string }) {
    const clauses = ["p.documentStatus='POSTED'", "p.documentDate>=?", "p.documentDate<=?"], params: unknown[] = [query.from, query.to];
    if (query.supplierId) { clauses.push("p.supplierId=?"); params.push(query.supplierId); }
    if (query.search) { clauses.push("(s.name LIKE ? OR s.code LIKE ? OR p.code LIKE ?)"); const value = `%${query.search}%`; params.push(value, value, value); }
    return prisma.$queryRawUnsafe<any[]>(`SELECT s.id supplierId, s.code supplierCode, s.name supplierName,
      COUNT(DISTINCT p.id) documents,
      COALESCE(SUM(p.goodsAmount),0) goodsAmount, COALESCE(SUM(p.taxAmount),0) taxAmount,
      COALESCE(SUM(p.totalAmount),0) totalAmount, COALESCE(SUM(p.paidAmount),0) paidAmount
      FROM purchase_documents p JOIN suppliers s ON s.id=p.supplierId
      WHERE ${clauses.join(" AND ")}
      GROUP BY s.id, s.code, s.name ORDER BY totalAmount DESC`, ...params);
  },
  purchasesByProduct(query: { from: string; to: string; warehouseId?: number; search?: string }) {
    const clauses = ["p.documentStatus='POSTED'", "p.documentDate>=?", "p.documentDate<=?"], params: unknown[] = [query.from, query.to];
    if (query.warehouseId) { clauses.push("pdd.warehouseId=?"); params.push(query.warehouseId); }
    if (query.search) { clauses.push("(pr.name LIKE ? OR pp.name LIKE ? OR pp.sku LIKE ?)"); const value = `%${query.search}%`; params.push(value, value, value); }
    return prisma.$queryRawUnsafe<any[]>(`SELECT pdd.packagingId, pp.sku, pp.name packagingName, pp.unit, pr.name productName,
      COUNT(DISTINCT p.id) documents, COALESCE(SUM(pdd.quantity),0) quantity,
      COALESCE(SUM(pdd.lineAmount),0) goodsAmount, COALESCE(SUM(pdd.taxAmount),0) taxAmount,
      COALESCE(SUM(pdd.lineAmount+pdd.taxAmount),0) totalAmount,
      COALESCE(SUM(pdd.quantity*pdd.unitPrice),0)/NULLIF(SUM(pdd.quantity),0) avgUnitPrice
      FROM purchase_document_details pdd
      JOIN purchase_documents p ON p.id=pdd.documentId
      JOIN productpackagings pp ON pp.id=pdd.packagingId JOIN products pr ON pr.id=pp.productId
      WHERE ${clauses.join(" AND ")}
      GROUP BY pdd.packagingId, pp.sku, pp.name, pp.unit, pr.name ORDER BY totalAmount DESC`, ...params);
  },
  salesReturns(query: { from: Date; toExclusive: Date; warehouseId?: number; customerId?: number; status?: string; search?: string }) {
    const clauses = ["sr.returnDate>=?", "sr.returnDate<?"], params: unknown[] = [query.from, query.toExclusive];
    if (query.warehouseId) { clauses.push("sr.warehouseId=?"); params.push(query.warehouseId); }
    if (query.customerId) { clauses.push("sr.customerId=?"); params.push(query.customerId); }
    if (query.status) { clauses.push("sr.status=?"); params.push(query.status); }
    if (query.search) { clauses.push("(sr.code LIKE ? OR c.name LIKE ? OR o.code LIKE ? OR sr.reason LIKE ?)"); const value = `%${query.search}%`; params.push(value, value, value, value); }
    return prisma.$queryRawUnsafe<any[]>(`SELECT sr.id, sr.code, sr.returnDate, sr.status, sr.reason, sr.settlementType,
      sr.subtotal, sr.taxAmount, sr.totalAmount, sr.costAmount,
      c.id customerId, c.code customerCode, c.name customerName,
      w.name warehouseName, o.code originalOrderCode, COUNT(srl.id) lineCount
      FROM sales_returns sr
      JOIN customers c ON c.id=sr.customerId JOIN warehouses w ON w.id=sr.warehouseId JOIN sales_orders o ON o.id=sr.originalSalesOrderId
      LEFT JOIN sales_return_lines srl ON srl.salesReturnId=sr.id
      WHERE ${clauses.join(" AND ")}
      GROUP BY sr.id, sr.code, sr.returnDate, sr.status, sr.reason, sr.settlementType, sr.subtotal, sr.taxAmount, sr.totalAmount, sr.costAmount, c.id, c.code, c.name, w.name, o.code
      ORDER BY sr.returnDate DESC, sr.id DESC LIMIT 1000`, ...params);
  },
  stockOnHand(query: { warehouseId?: number; category?: string; search?: string }) {
    const clauses: string[] = ["1=1"], params: unknown[] = [];
    if (query.warehouseId) { clauses.push("pw.warehouseId=?"); params.push(query.warehouseId); }
    if (query.category) { clauses.push("pr.category=?"); params.push(query.category); }
    if (query.search) { clauses.push("(pr.name LIKE ? OR pp.name LIKE ? OR pp.sku LIKE ?)"); const value = `%${query.search}%`; params.push(value, value, value); }
    return prisma.$queryRawUnsafe<any[]>(`SELECT pp.id packagingId, pp.sku, pp.name packagingName, pp.unit, COALESCE(pp.min_stock,0) minStock,
      pr.id productId, pr.name productName, pr.category,
      COALESCE(SUM(pw.stock_quantity),0) stockQuantity,
      COALESCE(price.lastPrice,0) unitCost,
      COALESCE(SUM(pw.stock_quantity),0)*COALESCE(price.lastPrice,0) stockValue
      FROM productpackagings pp JOIN products pr ON pr.id=pp.productId
      LEFT JOIN productwarehouses pw ON pw.packagingId=pp.id
      LEFT JOIN (SELECT pdd.packagingId, pdd.unitPrice lastPrice FROM purchase_document_details pdd
        JOIN (SELECT packagingId, MAX(id) maxId FROM purchase_document_details GROUP BY packagingId) latest ON latest.maxId=pdd.id) price ON price.packagingId=pp.id
      WHERE ${clauses.join(" AND ")}
      GROUP BY pp.id, pp.sku, pp.name, pp.unit, pp.min_stock, pr.id, pr.name, pr.category, price.lastPrice
      ORDER BY stockValue DESC`, ...params);
  },
  salesInRange(from: string, to: string) {
    return prisma.$queryRawUnsafe<any[]>(`SELECT COALESCE(SUM(so.totalAmount),0) revenue, COALESCE(SUM(so.taxAmount),0) tax
      FROM sales_orders so WHERE so.status='FULFILLED' AND so.orderDate>=? AND so.orderDate<=?`, from, to);
  },
  cogsInRange(from: string, to: string) {
    return prisma.$queryRawUnsafe<any[]>(`SELECT COALESCE(SUM(sod.costAmount),0) cogs
      FROM sales_order_details sod JOIN sales_orders so ON so.id=sod.orderId
      WHERE so.status='FULFILLED' AND so.orderDate>=? AND so.orderDate<=?`, from, to);
  },
  purchasesInRange(from: string, to: string) {
    return prisma.$queryRawUnsafe<any[]>(`SELECT COALESCE(SUM(p.totalAmount),0) total, COALESCE(SUM(p.paidAmount),0) paid
      FROM purchase_documents p WHERE p.documentStatus='POSTED' AND p.documentDate>=? AND p.documentDate<=?`, from, to);
  },
  returnsInRange(from: Date, toExclusive: Date) {
    return prisma.$queryRawUnsafe<any[]>(`SELECT COALESCE(SUM(sr.totalAmount),0) total, COALESCE(SUM(sr.costAmount),0) cost
      FROM sales_returns sr WHERE sr.status='POSTED' AND sr.returnDate>=? AND sr.returnDate<?`, from, toExclusive);
  },
  receivableOutstanding(asOf: Date) {
    return prisma.$queryRawUnsafe<any[]>(`SELECT COALESCE(SUM(amount),0) outstanding FROM receivable_transactions WHERE occurredAt<?`, asOf);
  },
  payableOutstanding(asOf: Date) {
    return prisma.$queryRawUnsafe<any[]>(`SELECT COALESCE(SUM(amount),0) outstanding FROM payable_transactions WHERE occurredAt<?`, asOf);
  },
  inventoryValueTotal() {
    return prisma.$queryRawUnsafe<any[]>(`SELECT COALESCE(SUM(x.stock*COALESCE(x.lastPrice,0)),0) value FROM (
      SELECT SUM(pw.stock_quantity) stock, (SELECT pdd.unitPrice FROM purchase_document_details pdd WHERE pdd.packagingId=pw.packagingId ORDER BY pdd.id DESC LIMIT 1) lastPrice
      FROM productwarehouses pw GROUP BY pw.packagingId) x`);
  },
  monthlyFinancial(months: number) {
    return prisma.$queryRawUnsafe<any[]>(`SELECT monthKey, SUM(revenue) revenue, SUM(cogs) cogs, SUM(purchases) purchases FROM (
      SELECT DATE_FORMAT(so.orderDate,'%Y-%m') monthKey, SUM(so.totalAmount) revenue, 0 cogs, 0 purchases
      FROM sales_orders so WHERE so.status='FULFILLED' AND so.orderDate>=DATE_SUB(CURDATE(), INTERVAL ? MONTH) GROUP BY DATE_FORMAT(so.orderDate,'%Y-%m')
      UNION ALL
      SELECT DATE_FORMAT(so.orderDate,'%Y-%m') monthKey, 0 revenue, SUM(sod.costAmount) cogs, 0 purchases
      FROM sales_order_details sod JOIN sales_orders so ON so.id=sod.orderId
      WHERE so.status='FULFILLED' AND so.orderDate>=DATE_SUB(CURDATE(), INTERVAL ? MONTH) GROUP BY DATE_FORMAT(so.orderDate,'%Y-%m')
      UNION ALL
      SELECT DATE_FORMAT(p.documentDate,'%Y-%m') monthKey, 0 revenue, 0 cogs, SUM(p.totalAmount) purchases
      FROM purchase_documents p WHERE p.documentStatus='POSTED' AND p.documentDate>=DATE_SUB(CURDATE(), INTERVAL ? MONTH) GROUP BY DATE_FORMAT(p.documentDate,'%Y-%m')
    ) data GROUP BY monthKey ORDER BY monthKey`, months, months, months);
  },
  topCustomerDebts(limit: number) {
    return prisma.$queryRawUnsafe<any[]>(`SELECT c.id, c.code, c.name, COALESCE(SUM(r.amount),0) debt
      FROM customers c JOIN receivable_transactions r ON r.customerId=c.id
      GROUP BY c.id, c.code, c.name HAVING debt>0.005 ORDER BY debt DESC LIMIT ?`, limit);
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