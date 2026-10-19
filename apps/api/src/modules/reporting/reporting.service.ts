import type { InventorySummaryReportQuery, ItemLedgerReportQuery, OperationsReportQuery, ProductionOverviewReportQuery, ProductionVarianceReportQuery, SalesByCustomerReportQuery, SalesByProductReportQuery, SalesProfitReportQuery, TransferReportQuery } from "@challenge/contracts";
import { HttpError } from "../../common/http-error";
import { reportingRepository } from "./reporting.repository";

const range = (from: string, to: string) => ({ from: new Date(`${from}T00:00:00.000Z`), toExclusive: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86400000) });
const n = (value: unknown) => Number(value || 0);
const round = (value: number) => Math.round(value * 100) / 100;

export const reportingService = {
  async inventorySummary(query: InventorySummaryReportQuery) {
    const rows = (await reportingRepository.inventorySummary({ ...range(query.from, query.to), warehouseId: query.warehouseId, category: query.category, search: query.search })).map(row => {
      const openingQuantity = n(row.openingQuantity), inboundQuantity = n(row.inboundQuantity), outboundQuantity = n(row.outboundQuantity), closingQuantity = openingQuantity + inboundQuantity - outboundQuantity;
      const openingValue = n(row.openingValue), inboundValue = n(row.inboundValue), outboundValue = n(row.outboundValue), closingValue = openingValue + inboundValue - outboundValue, projectionQuantity = n(row.projectionQuantity);
      return { packagingId: row.packagingId, warehouseId: row.warehouseId, sku: row.sku, packagingName: row.packagingName, unit: row.unit, productName: row.productName, category: row.category, warehouseName: row.warehouseName, openingQuantity, inboundQuantity, outboundQuantity, closingQuantity, openingValue: round(openingValue), inboundValue: round(inboundValue), outboundValue: round(outboundValue), closingValue: round(closingValue), projectionQuantity, projectionDifference: round(projectionQuantity - closingQuantity), valueCoverageComplete: Math.abs(n(row.openingBaselineQuantity)) < 0.00005 };
    });
    const summary = rows.reduce((sum, row) => ({ openingQuantity: sum.openingQuantity + row.openingQuantity, inboundQuantity: sum.inboundQuantity + row.inboundQuantity, outboundQuantity: sum.outboundQuantity + row.outboundQuantity, closingQuantity: sum.closingQuantity + row.closingQuantity, openingValue: sum.openingValue + row.openingValue, inboundValue: sum.inboundValue + row.inboundValue, outboundValue: sum.outboundValue + row.outboundValue, closingValue: sum.closingValue + row.closingValue, projectionDifference: sum.projectionDifference + row.projectionDifference }), { openingQuantity: 0, inboundQuantity: 0, outboundQuantity: 0, closingQuantity: 0, openingValue: 0, inboundValue: 0, outboundValue: 0, closingValue: 0, projectionDifference: 0 });
    return { rows, summary, valueCoverageComplete: rows.every(row => row.valueCoverageComplete) };
  },
  async itemLedger(query: ItemLedgerReportQuery) {
    const packaging = await reportingRepository.packaging(query.packagingId); if (!packaging) throw new HttpError(404, "PACKAGING_NOT_FOUND", "Không tìm thấy quy cách hàng hóa");
    const dates = range(query.from, query.to), [openingRows, movements] = await Promise.all([reportingRepository.itemOpening({ from: dates.from, packagingId: query.packagingId, warehouseId: query.warehouseId }), reportingRepository.itemLedger({ ...dates, packagingId: query.packagingId, warehouseId: query.warehouseId })]);
    let runningQuantity = n(openingRows[0]?.quantity), runningValue = n(openingRows[0]?.totalValue);
    const rows = movements.map(row => { const quantity = n(row.quantity), totalValue = n(row.totalValue), inboundQuantity = row.direction === "IN" ? quantity : 0, outboundQuantity = row.direction === "OUT" ? quantity : 0, inboundValue = row.direction === "IN" ? totalValue : 0, outboundValue = row.direction === "OUT" ? totalValue : 0; runningQuantity += inboundQuantity - outboundQuantity; runningValue += inboundValue - outboundValue; return { id: String(row.id), occurredAt: row.occurredAt, documentCode: row.documentCode, sourceType: row.sourceType, sourceId: row.sourceId, direction: row.direction, warehouseId: row.warehouseId, warehouseName: row.warehouseName, inboundQuantity, outboundQuantity, unitCost: n(row.unitCost), inboundValue, outboundValue, runningQuantity, runningValue: round(runningValue) }; });
    return { packaging: { id: packaging.id, sku: packaging.sku, name: packaging.name, unit: packaging.unit, productName: packaging.products?.name }, openingQuantity: n(openingRows[0]?.quantity), openingValue: round(n(openingRows[0]?.totalValue)), valueCoverageComplete: Math.abs(n(openingRows[0]?.baselineQuantity)) < 0.00005, rows, closingQuantity: runningQuantity, closingValue: round(runningValue) };
  },
  async salesProfit(query: SalesProfitReportQuery) {
    const rows = (await reportingRepository.salesProfit(query)).map(row => ({ id: row.id, code: row.code, orderDate: row.orderDate, customerId: row.customerId, customerCode: row.customerCode, customerName: row.customerName, warehouseId: row.warehouseId, warehouseName: row.warehouseName, grossSales: round(n(row.grossSales)), discountAmount: round(n(row.discountAmount)), netRevenue: round(n(row.netRevenue)), taxAmount: round(n(row.taxAmount)), cogs: round(n(row.cogs)), grossProfit: round(n(row.netRevenue) - n(row.cogs)), grossMarginPercent: n(row.netRevenue) ? round((n(row.netRevenue) - n(row.cogs)) / n(row.netRevenue) * 100) : 0 }));
    return { rows, summary: rows.reduce((sum, row) => ({ grossSales: sum.grossSales + row.grossSales, discountAmount: sum.discountAmount + row.discountAmount, netRevenue: sum.netRevenue + row.netRevenue, taxAmount: sum.taxAmount + row.taxAmount, cogs: sum.cogs + row.cogs, grossProfit: sum.grossProfit + row.grossProfit }), { grossSales: 0, discountAmount: 0, netRevenue: 0, taxAmount: 0, cogs: 0, grossProfit: 0 }) };
  },
  async operations(query: OperationsReportQuery) {
    const dates = range(query.from, query.to), common = { ...dates, warehouseId: query.warehouseId, search: query.search };
    const [production, assembly, disassembly] = await Promise.all([!query.type || query.type === "PRODUCTION" ? reportingRepository.production(common) : [], !query.type || query.type === "ASSEMBLY" ? reportingRepository.assembly(common) : [], !query.type || query.type === "DISASSEMBLY" ? reportingRepository.disassembly(common) : []]);
    const rows = [
      ...production.map(row => ({ id: row.id, type: "PRODUCTION" as const, code: row.code, occurredAt: row.completedAt, itemName: row.products?.name, plannedQuantity: n(row.total_sachets), actualQuantity: row.productiondetails.reduce((sum, line) => sum + n(line.actual_quantity), 0), inputValue: round(row.production_order_materials_v1.reduce((sum, line) => sum + n(line.totalValue), 0)), outputValue: round(row.productiondetails.reduce((sum, line) => sum + n(line.totalValue), 0)), lossQuantity: 0 })),
      ...assembly.map(row => ({ id: row.id, type: "ASSEMBLY" as const, code: row.code, occurredAt: row.postedAt, itemName: `${row.output.products?.name} - ${row.output.name}`, plannedQuantity: n(row.plannedQuantity), actualQuantity: n(row.actualQuantity), inputValue: round(row.lines.reduce((sum, line) => sum + n(line.totalValue), 0)), outputValue: n(row.outputTotalValue), lossQuantity: 0 })),
      ...disassembly.map(row => ({ id: row.id, type: "DISASSEMBLY" as const, code: row.code, occurredAt: row.postedAt, itemName: `${row.source.products?.name} - ${row.source.name}`, plannedQuantity: n(row.plannedQuantity), actualQuantity: n(row.actualQuantity), inputValue: n(row.sourceTotalValue), outputValue: round(row.lines.reduce((sum, line) => sum + n(line.totalValue), 0)), lossQuantity: row.lines.reduce((sum, line) => sum + n(line.lossQuantity), 0) })),
    ].sort((a, b) => new Date(a.occurredAt || 0).getTime() - new Date(b.occurredAt || 0).getTime());
    return { rows, summary: rows.reduce((sum, row) => ({ orders: sum.orders + 1, plannedQuantity: sum.plannedQuantity + row.plannedQuantity, actualQuantity: sum.actualQuantity + row.actualQuantity, inputValue: sum.inputValue + row.inputValue, outputValue: sum.outputValue + row.outputValue, lossQuantity: sum.lossQuantity + row.lossQuantity }), { orders: 0, plannedQuantity: 0, actualQuantity: 0, inputValue: 0, outputValue: 0, lossQuantity: 0 }) };
  },
  async salesByCustomer(query: SalesByCustomerReportQuery) {
    const rows = (await reportingRepository.salesByCustomer(query)).map(row => ({ customerId: row.customerId, customerCode: row.customerCode, customerName: row.customerName, groupId: row.groupId, groupName: row.groupName, orders: n(row.orders), grossSales: round(n(row.grossSales)), discountAmount: round(n(row.discountAmount)), netRevenue: round(n(row.netRevenue)), taxAmount: round(n(row.taxAmount)), cogs: round(n(row.cogs)), grossProfit: round(n(row.netRevenue) - n(row.cogs)), grossMarginPercent: n(row.netRevenue) ? round((n(row.netRevenue) - n(row.cogs)) / n(row.netRevenue) * 100) : 0 }));
    return { rows, summary: rows.reduce((sum, row) => ({ orders: sum.orders + row.orders, grossSales: sum.grossSales + row.grossSales, discountAmount: sum.discountAmount + row.discountAmount, netRevenue: sum.netRevenue + row.netRevenue, taxAmount: sum.taxAmount + row.taxAmount, cogs: sum.cogs + row.cogs, grossProfit: sum.grossProfit + row.grossProfit }), { orders: 0, grossSales: 0, discountAmount: 0, netRevenue: 0, taxAmount: 0, cogs: 0, grossProfit: 0 }) };
  },
  async salesByProduct(query: SalesByProductReportQuery) {
    const rows = (await reportingRepository.salesByProduct(query)).map(row => ({ packagingId: row.packagingId, sku: row.sku, packagingName: row.packagingName, unit: row.unit, productName: row.productName, quantity: n(row.quantity), grossSales: round(n(row.grossSales)), discountAmount: round(n(row.discountAmount)), netRevenue: round(n(row.netRevenue)), cogs: round(n(row.cogs)), grossProfit: round(n(row.netRevenue) - n(row.cogs)), grossMarginPercent: n(row.netRevenue) ? round((n(row.netRevenue) - n(row.cogs)) / n(row.netRevenue) * 100) : 0 }));
    return { rows, summary: rows.reduce((sum, row) => ({ quantity: sum.quantity + row.quantity, grossSales: sum.grossSales + row.grossSales, discountAmount: sum.discountAmount + row.discountAmount, netRevenue: sum.netRevenue + row.netRevenue, cogs: sum.cogs + row.cogs, grossProfit: sum.grossProfit + row.grossProfit }), { quantity: 0, grossSales: 0, discountAmount: 0, netRevenue: 0, cogs: 0, grossProfit: 0 }) };
  },
  async productionOverview(query: ProductionOverviewReportQuery) {
    const dates = range(query.from, query.to);
    const rows = (await reportingRepository.productionOverview({ ...dates, warehouseId: query.warehouseId, search: query.search })).map(row => ({ packagingId: row.packagingId, sku: row.sku, packagingName: row.packagingName, unit: row.unit, productName: row.productName, orders: n(row.orders), plannedPacks: n(row.plannedPacks), actualPacks: n(row.actualPacks), powderKg: round(n(row.powderKg)) }));
    return { rows, summary: rows.reduce((sum, row) => ({ plannedPacks: sum.plannedPacks + row.plannedPacks, actualPacks: sum.actualPacks + row.actualPacks, powderKg: round(sum.powderKg + row.powderKg) }), { plannedPacks: 0, actualPacks: 0, powderKg: 0 }) };
  },
  async transfers(query: TransferReportQuery) {
    const rows = await reportingRepository.transfers(query);
    return { rows, summary: (rows as any[]).reduce((sum: any, row: any) => ({ docs: sum.docs + 1, quantity: sum.quantity + n(row.quantity) }), { docs: 0, quantity: 0 }) };
  },
  async productionVariance(query: ProductionVarianceReportQuery) {
    const raw = await reportingRepository.productionVariance({ ...range(query.from, query.to), warehouseId: query.warehouseId, search: query.search });
    const rows = raw.map(row => {
      const plannedOutput = n(row.plannedOutput), actualOutput = n(row.actualOutput), plannedMaterialQuantity = n(row.plannedQuantity), actualMaterialQuantity = n(row.actualQuantity), unitCost = n(row.unitCost);
      const plannedMaterialValue = round(plannedMaterialQuantity * unitCost), actualMaterialValue = round(n(row.totalValue));
      return {
        orderId: row.orderId, code: row.code, completedAt: row.completedAt, warehouseId: row.warehouseId, warehouseName: row.warehouseName,
        productId: row.productId, productName: row.productName, plannedOutput, actualOutput,
        outputVariance: round(actualOutput - plannedOutput), outputVariancePercent: plannedOutput ? round((actualOutput - plannedOutput) / plannedOutput * 100) : 0,
        materialId: String(row.materialId), packagingId: row.packagingId, sku: row.sku, packagingName: row.packagingName, unit: row.unit, materialName: row.materialName,
        plannedMaterialQuantity, actualMaterialQuantity, materialQuantityVariance: round(actualMaterialQuantity - plannedMaterialQuantity),
        materialVariancePercent: plannedMaterialQuantity ? round((actualMaterialQuantity - plannedMaterialQuantity) / plannedMaterialQuantity * 100) : 0,
        unitCost: round(unitCost), plannedMaterialValue, actualMaterialValue, materialValueVariance: round(actualMaterialValue - plannedMaterialValue),
      };
    });
    const orders = new Map<number, { planned: number; actual: number }>();
    for (const row of rows) orders.set(row.orderId, { planned: row.plannedOutput, actual: row.actualOutput });
    return { rows, summary: {
      orders: orders.size,
      plannedOutput: round([...orders.values()].reduce((sum, row) => sum + row.planned, 0)),
      actualOutput: round([...orders.values()].reduce((sum, row) => sum + row.actual, 0)),
      outputVariance: round([...orders.values()].reduce((sum, row) => sum + row.actual - row.planned, 0)),
      plannedMaterialValue: round(rows.reduce((sum, row) => sum + row.plannedMaterialValue, 0)),
      actualMaterialValue: round(rows.reduce((sum, row) => sum + row.actualMaterialValue, 0)),
      materialValueVariance: round(rows.reduce((sum, row) => sum + row.materialValueVariance, 0)),
      materialLines: rows.length,
      overConsumedLines: rows.filter(row => row.materialQuantityVariance > 0.00005).length,
      underConsumedLines: rows.filter(row => row.materialQuantityVariance < -0.00005).length,
    } };
  },
};