import {
  allocateCosts,
  type CostAllocation,
  type CostEntryForAllocation,
  type CostOrderLine,
} from "./costing-allocation";

const n = (value: unknown) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};
const round2 = (value: number) => Math.round(value * 100) / 100;
const round4 = (value: number) => Math.round(value * 10000) / 10000;

export type CostBreakdownItem = {
  costCenterId: number;
  code: string;
  name: string;
  category: string;
  amount: number;
};

export type ProductionCostRow = {
  packagingId: number;
  sku: string | null;
  packagingName: string;
  unit: string | null;
  productName: string;
  orders: number;
  plannedPacks: number;
  actualPacks: number;
  powderKg: number;
  materialValue: number;
  materialCostPerUnit: number;
  overheadCost: number;
  overheadBreakdown: CostBreakdownItem[];
  totalCost: number;
  costPerUnit: number;
};

const groupByPackaging = (allocations: CostAllocation[]) => {
  const map = new Map<number, CostAllocation[]>();
  for (const allocation of allocations) {
    if (!map.has(allocation.packagingId)) map.set(allocation.packagingId, []);
    map.get(allocation.packagingId)!.push(allocation);
  }
  return map;
};

export const summarizeBreakdown = (
  rows: Array<{ overheadBreakdown: CostBreakdownItem[] }>,
) => {
  const map = new Map<number, CostBreakdownItem>();
  for (const row of rows) {
    for (const item of row.overheadBreakdown) {
      const current = map.get(item.costCenterId);
      if (current) {
        current.amount = round2(current.amount + item.amount);
      } else {
        map.set(item.costCenterId, { ...item });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
};

export function buildProductionCostReport(
  rawRows: any[],
  entries: CostEntryForAllocation[],
  orderLines: CostOrderLine[],
) {
  const baseRows = rawRows.map(row => ({
    packagingId: Number(row.packagingId),
    sku: row.sku || null,
    packagingName: row.packagingName || "",
    unit: row.unit || null,
    productName: row.productName || "",
    orders: n(row.orders),
    plannedPacks: n(row.plannedPacks),
    actualPacks: n(row.actualPacks),
    powderKg: round2(n(row.powderKg)),
    materialValue: round2(n(row.materialValue)),
  }));

  const allocations = allocateCosts(baseRows, orderLines, entries);
  const byPackaging = groupByPackaging(allocations);

  const rows: ProductionCostRow[] = baseRows.map(row => {
    const overheadBreakdown: CostBreakdownItem[] = (byPackaging.get(row.packagingId) || [])
      .map(allocation => ({
        costCenterId: allocation.costCenterId,
        code: allocation.code,
        name: allocation.name,
        category: allocation.category,
        amount: round2(allocation.amount),
      }))
      .filter(item => item.amount !== 0)
      .sort((a, b) => b.amount - a.amount);
    const overheadCost = round2(
      overheadBreakdown.reduce((sum, item) => sum + item.amount, 0),
    );
    const totalCost = round2(row.materialValue + overheadCost);
    return {
      ...row,
      materialCostPerUnit: row.actualPacks
        ? round4(row.materialValue / row.actualPacks)
        : 0,
      overheadCost,
      overheadBreakdown,
      totalCost,
      costPerUnit: row.actualPacks ? round4(totalCost / row.actualPacks) : 0,
    };
  });

  const summaryBase = rows.reduce(
    (sum, row) => ({
      plannedPacks: sum.plannedPacks + row.plannedPacks,
      actualPacks: sum.actualPacks + row.actualPacks,
      powderKg: sum.powderKg + row.powderKg,
      materialValue: sum.materialValue + row.materialValue,
      overheadCost: sum.overheadCost + row.overheadCost,
      totalCost: sum.totalCost + row.totalCost,
    }),
    {
      plannedPacks: 0,
      actualPacks: 0,
      powderKg: 0,
      materialValue: 0,
      overheadCost: 0,
      totalCost: 0,
    },
  );

  const summary = {
    plannedPacks: summaryBase.plannedPacks,
    actualPacks: summaryBase.actualPacks,
    powderKg: round2(summaryBase.powderKg),
    materialValue: round2(summaryBase.materialValue),
    overheadCost: round2(summaryBase.overheadCost),
    totalCost: round2(summaryBase.totalCost),
    avgMaterialCostPerUnit: summaryBase.actualPacks
      ? round4(summaryBase.materialValue / summaryBase.actualPacks)
      : 0,
    avgCostPerUnit: summaryBase.actualPacks
      ? round4(summaryBase.totalCost / summaryBase.actualPacks)
      : 0,
    overheadBreakdown: summarizeBreakdown(rows),
  };

  return { rows, summary };
}
