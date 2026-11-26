import {
  allocateCosts,
  type CostAllocation,
  type CostEntryForAllocation,
  type CostOrderLine,
} from "./costing-allocation";
import {
  summarizeBreakdown,
  type CostBreakdownItem,
} from "./production-cost-report";

const n = (value: unknown) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};
const round2 = (value: number) => Math.round(value * 100) / 100;
const round4 = (value: number) => Math.round(value * 10000) / 10000;

export type PackCostLookup = {
  /** Giá cost 1 gói đã tính ở tầng sản xuất. */
  unitCost: number;
  /** Lượng bột (kg) tương ứng 1 gói, dùng cho tiêu thức BY_POWDER_KG. */
  powderPerUnit: number;
};

export type AssemblyComponentSummary = {
  packagingId: number;
  sku: string | null;
  name: string;
  unit: string | null;
  quantity: number;
  unitCost: number;
  value: number;
  /** PRODUCTION: lấy giá cost gói vừa tính; INVENTORY: giá vốn hiện có. */
  source: "PRODUCTION" | "INVENTORY";
};

export type AssemblyCostRow = {
  packagingId: number;
  sku: string | null;
  packagingName: string;
  unit: string | null;
  productName: string;
  orders: number;
  actualQty: number;
  /** Phần sản lượng lấy theo kế hoạch vì lệnh chưa nhập số thực tế. */
  plannedQty: number;
  /** Giá trị gói thành phần (tầng 1). */
  packValue: number;
  /** Hộp, keo dán, thùng... xuất kho cho lắp ráp. */
  assemblyMaterialValue: number;
  /** Chi phí lắp ráp nhập thêm trên lệnh. */
  assemblyExtraCost: number;
  /** Tổng chi phí trước phân bổ = gói + vật tư lắp ráp + chi phí lắp ráp. */
  externalCost: number;
  materialCostPerUnit: number;
  powderKg: number;
  overheadCost: number;
  overheadBreakdown: CostBreakdownItem[];
  totalCost: number;
  costPerUnit: number;
  /** Giá trị vật tư phải dùng giá vốn hiện có (chưa có giá SX trong kỳ). */
  inventoryValue: number;
  components: AssemblyComponentSummary[];
};

export type AssemblyCostSummary = {
  orders: number;
  actualQty: number;
  plannedQty: number;
  packValue: number;
  assemblyMaterialValue: number;
  assemblyExtraCost: number;
  externalCost: number;
  overheadCost: number;
  totalCost: number;
  avgMaterialCostPerUnit: number;
  avgCostPerUnit: number;
  inventoryValue: number;
  overheadBreakdown: CostBreakdownItem[];
};

type Accumulator = {
  packagingId: number;
  sku: string | null;
  packagingName: string;
  unit: string | null;
  productName: string;
  orders: number;
  actualQty: number;
  plannedQty: number;
  packValue: number;
  assemblyMaterialValue: number;
  assemblyExtraCost: number;
  powderKg: number;
  inventoryValue: number;
  components: Map<number, AssemblyComponentSummary>;
};

const groupAllocations = (allocations: CostAllocation[]) => {
  const map = new Map<number, CostAllocation[]>();
  for (const allocation of allocations) {
    if (!map.has(allocation.packagingId)) map.set(allocation.packagingId, []);
    map.get(allocation.packagingId)!.push(allocation);
  }
  return map;
};

/**
 * Dựng báo cáo giá thành tầng 2 (hộp/túi lắp ráp).
 *
 * Mỗi quy cách đầu ra được cộng:
 *   giá trị gói (lấy từ giá cost tầng 1 hoặc giá vốn hiện có)
 *   + vật tư lắp ráp (hộp, keo dán, thùng...)
 *   + chi phí lắp ráp nhập thêm
 *   + chi phí phân bổ của kỳ / của lệnh lắp ráp.
 */
export function buildAssemblyCostReport(
  orders: any[],
  packCosts: Map<number, PackCostLookup>,
  entries: CostEntryForAllocation[],
) {
  const rowsByPackaging = new Map<number, Accumulator>();

  for (const order of orders) {
    const actualQuantity = n(order.actualQuantity);
    const plannedQuantity = n(order.plannedQuantity);
    // Lệnh cũ/import có thể chỉ có số lượng kế hoạch: dùng kế hoạch thay thế
    // và ghi nhận riêng để báo cáo minh bạch.
    const quantity = actualQuantity > 0 ? actualQuantity : plannedQuantity;
    if (quantity <= 0) continue;
    const plannedPortion = actualQuantity > 0 ? 0 : quantity;
    const packagingId = Number(order.outputPackagingId);
    if (!packagingId) continue;

    let row = rowsByPackaging.get(packagingId);
    if (!row) {
      row = {
        packagingId,
        sku: order.output?.sku || null,
        packagingName: order.output?.name || "",
        unit: order.output?.unit || null,
        productName: order.output?.products?.name || "",
        orders: 0,
        actualQty: 0,
        plannedQty: 0,
        packValue: 0,
        assemblyMaterialValue: 0,
        assemblyExtraCost: 0,
        powderKg: 0,
        inventoryValue: 0,
        components: new Map(),
      };
      rowsByPackaging.set(packagingId, row);
    }

    row.orders += 1;
    row.actualQty += quantity;
    row.plannedQty += plannedPortion;
    row.assemblyExtraCost += n(order.assemblyCost);

    for (const line of order.lines || []) {
      const componentPackagingId = Number(line.componentPackagingId);
      if (!componentPackagingId) continue;
      const actualLineQty = n(line.actualQuantity);
      const lineQuantity =
        actualLineQty > 0 ? actualLineQty : n(line.plannedQuantity);
      if (lineQuantity <= 0) continue;

      const lookup = packCosts.get(componentPackagingId);
      let value = 0;
      let source: "PRODUCTION" | "INVENTORY" = "INVENTORY";

      if (lookup && lookup.unitCost > 0) {
        value = lineQuantity * lookup.unitCost;
        source = "PRODUCTION";
        row.packValue += value;
        row.powderKg += lineQuantity * lookup.powderPerUnit;
      } else {
        const inventoryUnitCost =
          n(line.unitCost) ||
          (n(line.totalValue) > 0 ? n(line.totalValue) / lineQuantity : 0);
        value = inventoryUnitCost * lineQuantity;
        row.assemblyMaterialValue += value;
        row.inventoryValue += value;
      }

      const current = row.components.get(componentPackagingId);
      if (current) {
        current.quantity += lineQuantity;
        current.value += value;
        current.unitCost = current.quantity ? current.value / current.quantity : 0;
        if (source === "PRODUCTION") current.source = "PRODUCTION";
        continue;
      }

      row.components.set(componentPackagingId, {
        packagingId: componentPackagingId,
        sku: line.component?.sku || null,
        name: line.component?.name || "",
        unit: line.component?.unit || null,
        quantity: lineQuantity,
        unitCost: lineQuantity ? value / lineQuantity : 0,
        value,
        source,
      });
    }
  }

  const entries_ = Array.from(rowsByPackaging.values());
  if (!entries_.length) {
    return {
      rows: [] as AssemblyCostRow[],
      summary: {
        orders: 0,
        actualQty: 0,
        plannedQty: 0,
        packValue: 0,
        assemblyMaterialValue: 0,
        assemblyExtraCost: 0,
        externalCost: 0,
        overheadCost: 0,
        totalCost: 0,
        avgMaterialCostPerUnit: 0,
        avgCostPerUnit: 0,
        inventoryValue: 0,
        overheadBreakdown: [],
      } satisfies AssemblyCostSummary,
    };
  }

  const baseRows = entries_.map(row => ({
    packagingId: row.packagingId,
    actualPacks: round4(row.actualQty),
    powderKg: round2(row.powderKg),
    materialValue: round2(
      row.packValue + row.assemblyMaterialValue + row.assemblyExtraCost,
    ),
  }));

  const assemblyOrderLines: CostOrderLine[] = orders
    .map(order => {
      const actualQuantity = n(order.actualQuantity);
      const quantity =
        actualQuantity > 0 ? actualQuantity : n(order.plannedQuantity);
      return {
        orderId: Number(order.id),
        packagingId: Number(order.outputPackagingId),
        actualPacks: quantity,
        allocationPercent: 0,
      };
    })
    .filter(line => line.actualPacks > 0);

  const allocations = allocateCosts(baseRows, [], entries, assemblyOrderLines);
  const byPackaging = groupAllocations(allocations);

  const rows: AssemblyCostRow[] = entries_.map(row => {
    const overheadBreakdown = (byPackaging.get(row.packagingId) || [])
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
    const externalCost = round2(
      row.packValue + row.assemblyMaterialValue + row.assemblyExtraCost,
    );
    const totalCost = round2(externalCost + overheadCost);
    return {
      packagingId: row.packagingId,
      sku: row.sku,
      packagingName: row.packagingName,
      unit: row.unit,
      productName: row.productName,
      orders: row.orders,
      actualQty: round4(row.actualQty),
      plannedQty: round4(row.plannedQty),
      packValue: round2(row.packValue),
      assemblyMaterialValue: round2(row.assemblyMaterialValue),
      assemblyExtraCost: round2(row.assemblyExtraCost),
      externalCost,
      materialCostPerUnit: row.actualQty
        ? round4(externalCost / row.actualQty)
        : 0,
      powderKg: round2(row.powderKg),
      overheadCost,
      overheadBreakdown,
      totalCost,
      costPerUnit: row.actualQty ? round4(totalCost / row.actualQty) : 0,
      inventoryValue: round2(row.inventoryValue),
      components: Array.from(row.components.values())
        .map(component => ({
          ...component,
          quantity: round4(component.quantity),
          unitCost: round4(component.unitCost),
          value: round2(component.value),
        }))
        .sort((a, b) => b.value - a.value),
    };
  });

  const summaryBase = rows.reduce(
    (sum, row) => ({
      orders: sum.orders + row.orders,
      actualQty: sum.actualQty + row.actualQty,
      plannedQty: sum.plannedQty + row.plannedQty,
      packValue: sum.packValue + row.packValue,
      assemblyMaterialValue:
        sum.assemblyMaterialValue + row.assemblyMaterialValue,
      assemblyExtraCost: sum.assemblyExtraCost + row.assemblyExtraCost,
      externalCost: sum.externalCost + row.externalCost,
      overheadCost: sum.overheadCost + row.overheadCost,
      totalCost: sum.totalCost + row.totalCost,
      inventoryValue: sum.inventoryValue + row.inventoryValue,
    }),
    {
      orders: 0,
      actualQty: 0,
      plannedQty: 0,
      packValue: 0,
      assemblyMaterialValue: 0,
      assemblyExtraCost: 0,
      externalCost: 0,
      overheadCost: 0,
      totalCost: 0,
      inventoryValue: 0,
    },
  );

  const summary: AssemblyCostSummary = {
    orders: summaryBase.orders,
    actualQty: round4(summaryBase.actualQty),
    plannedQty: round4(summaryBase.plannedQty),
    packValue: round2(summaryBase.packValue),
    assemblyMaterialValue: round2(summaryBase.assemblyMaterialValue),
    assemblyExtraCost: round2(summaryBase.assemblyExtraCost),
    externalCost: round2(summaryBase.externalCost),
    overheadCost: round2(summaryBase.overheadCost),
    totalCost: round2(summaryBase.totalCost),
    avgMaterialCostPerUnit: summaryBase.actualQty
      ? round4(summaryBase.externalCost / summaryBase.actualQty)
      : 0,
    avgCostPerUnit: summaryBase.actualQty
      ? round4(summaryBase.totalCost / summaryBase.actualQty)
      : 0,
    inventoryValue: round2(summaryBase.inventoryValue),
    overheadBreakdown: summarizeBreakdown(rows),
  };

  return { rows, summary };
}
