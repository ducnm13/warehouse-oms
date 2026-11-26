const iso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : value ?? null;
const dateOnly = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value ? String(value).slice(0, 10) : null;
};
const num = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const mapCostCenter = (row: any) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  category: row.category,
  defaultAllocationMethod: row.defaultAllocationMethod,
  description: row.description || null,
  isActive: Boolean(row.isActive),
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
});

export const mapCostEntry = (row: any) => ({
  id: row.id,
  code: row.code,
  costDate: dateOnly(row.costDate),
  periodMonth: row.periodMonth || null,
  costCenterId: row.costCenterId,
  costCenterCode: row.costCenter?.code || null,
  costCenterName: row.costCenter?.name || null,
  costCenterCategory: row.costCenter?.category || null,
  warehouseId: row.warehouseId ?? null,
  warehouseName: row.warehouse?.name || null,
  productionOrderId: row.productionOrderId ?? null,
  productionOrderCode: row.productionOrder?.code || null,
  assemblyOrderId: row.assemblyOrderId ?? null,
  assemblyOrderCode: row.assemblyOrder?.code || null,
  costTier: row.costTier || "PACK",
  incidentId: row.incidentId ?? null,
  incidentCode: row.incident?.code || null,
  incidentTitle: row.incident?.title || null,
  amount: num(row.amount),
  allocationMethod: row.allocationMethod || null,
  note: row.note || null,
  status: row.status,
  createdBy: row.createdBy,
  creatorName: row.creator?.fullName || row.creator?.username || null,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
});

export const mapCostSheet = (row: any, options: { detail?: boolean } = {}) => {
  const lines = row.lines || [];
  const totalCost = lines.length
    ? lines.reduce((sum: number, line: any) => sum + num(line.allocatedAmount), 0)
    : num(row._sum?.allocatedAmount);
  const totalPackCost = lines.length
    ? lines
        .filter((line: any) => (line.tier || "PACK") === "PACK")
        .reduce((sum: number, line: any) => sum + num(line.allocatedAmount), 0)
    : num(row._sum?.packAllocatedAmount);
  const totalAssemblyCost = lines.length
    ? lines
        .filter((line: any) => line.tier === "ASSEMBLY")
        .reduce((sum: number, line: any) => sum + num(line.allocatedAmount), 0)
    : num(row._sum?.assemblyAllocatedAmount);
  return {
    id: row.id,
    code: row.code,
    fromDate: dateOnly(row.fromDate),
    toDate: dateOnly(row.toDate),
    warehouseId: row.warehouseId ?? null,
    warehouseName: row.warehouse?.name || null,
    status: row.status,
    note: row.note || null,
    createdBy: row.createdBy,
    creatorName: row.creator?.fullName || row.creator?.username || null,
    createdAt: iso(row.createdAt),
    postedAt: iso(row.postedAt),
    lineCount: row._count?.lines ?? lines.length,
    totalCost: Math.round(totalCost * 100) / 100,
    totalPackCost: Math.round(totalPackCost * 100) / 100,
    totalAssemblyCost: Math.round(totalAssemblyCost * 100) / 100,
    ...(options.detail
      ? {
          lines: lines.map((line: any) => ({
            id: line.id,
            packagingId: line.packagingId,
            packagingSku: line.packaging?.sku || null,
            packagingName: line.packaging?.name || null,
            productName: line.packaging?.products?.name || null,
            unit: line.packaging?.unit || null,
            costCenterId: line.costCenterId ?? null,
            costCenterCode: line.costCenter?.code || null,
            costCenterName: line.costCenter?.name || null,
            costComponent: line.costComponent,
            tier: line.tier || "PACK",
            actualQty: num(line.actualQty),
            allocatedAmount: num(line.allocatedAmount),
            unitCost: num(line.unitCost),
          })),
        }
      : {}),
  };
};
