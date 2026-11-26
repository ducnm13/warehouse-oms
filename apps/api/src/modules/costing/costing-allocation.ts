import type { AllocationMethod } from "@challenge/contracts";

export interface CostBaseRow {
  packagingId: number;
  actualPacks: number;
  powderKg: number;
  materialValue: number;
}

export interface CostOrderLine {
  orderId: number;
  packagingId: number;
  actualPacks: number;
  allocationPercent: number;
}

export interface CostEntryForAllocation {
  id: number;
  amount: number;
  allocationMethod: string | null;
  productionOrderId: number | null;
  assemblyOrderId?: number | null;
  costTier?: string | null;
  costCenterId: number;
  costCenterCode: string;
  costCenterName: string;
  costCenterCategory: string;
  costCenterDefaultMethod: string;
}

export interface CostAllocation {
  packagingId: number;
  costCenterId: number;
  code: string;
  name: string;
  category: string;
  amount: number;
}

const WEIGHT_BY_METHOD: Record<AllocationMethod, keyof CostBaseRow> = {
  BY_ACTUAL_QTY: "actualPacks",
  BY_POWDER_KG: "powderKg",
  BY_MATERIAL_VALUE: "materialValue",
  // Không có nhập tay từng dòng, MANUAL tạm thời phân bổ theo sản lượng thực tế
  // để tổng chi phí luôn khớp 100% với chứng từ đầu vào.
  MANUAL: "actualPacks",
};

const toMethod = (value: string | null | undefined): AllocationMethod => {
  const method = String(value || "").toUpperCase();
  if (
    method === "BY_ACTUAL_QTY" ||
    method === "BY_POWDER_KG" ||
    method === "BY_MATERIAL_VALUE" ||
    method === "MANUAL"
  ) {
    return method;
  }
  return "BY_ACTUAL_QTY";
};

const weightOf = (method: AllocationMethod, row: CostBaseRow) => {
  const value = Number(row[WEIGHT_BY_METHOD[method]] || 0);
  return Number.isFinite(value) ? value : 0;
};

type Target = { packagingId: number; weight: number; actualPacks: number };

/**
 * Phân bổ chi phí gián tiếp cho từng mã thành phẩm.
 *
 * - Chứng từ gắn lệnh sản xuất: chia cho các quy cách của lệnh theo
 *   allocation_percent (nếu có) hoặc sản lượng thực tế.
 * - Chứng từ theo kỳ: chia theo tiêu thức của chứng từ / đối tượng chi phí.
 * - Mỗi chứng từ được làm tròn tới đồng và phần lẻ được dồn vào dòng có
 *   sản lượng thực tế lớn nhất, nhờ vậy tổng phân bổ luôn bằng đúng số tiền.
 */
export function allocateCosts(
  baseRows: CostBaseRow[],
  orderLines: CostOrderLine[],
  entries: CostEntryForAllocation[],
  assemblyOrderLines: CostOrderLine[] = [],
): CostAllocation[] {
  const baseByPackaging = new Map(
    baseRows.map(row => [Number(row.packagingId), row]),
  );
  const linesByOrder = new Map<number, CostOrderLine[]>();
  for (const line of orderLines) {
    const orderId = Number(line.orderId);
    if (!linesByOrder.has(orderId)) linesByOrder.set(orderId, []);
    linesByOrder.get(orderId)!.push(line);
  }
  const assemblyLinesByOrder = new Map<number, CostOrderLine[]>();
  for (const line of assemblyOrderLines) {
    const orderId = Number(line.orderId);
    if (!assemblyLinesByOrder.has(orderId)) assemblyLinesByOrder.set(orderId, []);
    assemblyLinesByOrder.get(orderId)!.push(line);
  }

  const totals = new Map<string, number>(); // key -> cents

  const add = (packagingId: number, entry: CostEntryForAllocation, cents: number) => {
    if (!cents) return;
    const key = `${packagingId}:${entry.costCenterId}`;
    totals.set(key, (totals.get(key) || 0) + cents);
  };

  for (const entry of entries) {
    const amountCents = Math.round(Number(entry.amount || 0) * 100);
    if (amountCents <= 0) continue;

    let targets: Target[] = [];

    if (entry.assemblyOrderId) {
      // Chi phí lắp ráp gắn trực tiếp một lệnh: dồn vào quy cách đầu ra của lệnh.
      const lines = assemblyLinesByOrder.get(Number(entry.assemblyOrderId)) || [];
      targets = lines.map(line => ({
        packagingId: Number(line.packagingId),
        weight: Math.max(0, Number(line.actualPacks || 0)),
        actualPacks: Math.max(0, Number(line.actualPacks || 0)),
      }));
    } else if (entry.productionOrderId) {
      const lines = linesByOrder.get(Number(entry.productionOrderId)) || [];
      const totalPercent = lines.reduce(
        (sum, line) => sum + Math.max(0, Number(line.allocationPercent || 0)),
        0,
      );
      targets = lines.map(line => ({
        packagingId: Number(line.packagingId),
        weight:
          totalPercent > 0
            ? Math.max(0, Number(line.allocationPercent || 0))
            : Math.max(0, Number(line.actualPacks || 0)),
        actualPacks: Math.max(0, Number(line.actualPacks || 0)),
      }));
    } else {
      const method = toMethod(entry.allocationMethod || entry.costCenterDefaultMethod);
      targets = baseRows.map(row => ({
        packagingId: Number(row.packagingId),
        weight: weightOf(method, row),
        actualPacks: Math.max(0, Number(row.actualPacks || 0)),
      }));
    }

    // Chỉ phân bổ cho các mã đang có trong báo cáo (tôn trọng bộ lọc tìm kiếm).
    targets = targets.filter(target => {
      const row = baseByPackaging.get(target.packagingId);
      if (!row) return false;
      if (!target.actualPacks) target.actualPacks = Math.max(0, Number(row.actualPacks || 0));
      return true;
    });

    // Gộp các dòng trùng quy cách (một lệnh có thể có nhiều dòng cùng packaging).
    const merged = new Map<number, Target>();
    for (const target of targets) {
      const current = merged.get(target.packagingId);
      if (current) {
        current.weight += target.weight;
        current.actualPacks = Math.max(current.actualPacks, target.actualPacks);
      } else {
        merged.set(target.packagingId, { ...target });
      }
    }
    targets = Array.from(merged.values());

    let totalWeight = targets.reduce((sum, target) => sum + target.weight, 0);
    if (totalWeight <= 0) {
      // Fallback: nếu tiêu thức không có dữ liệu thì dùng sản lượng thực tế.
      targets = targets.map(target => {
        const row = baseByPackaging.get(target.packagingId);
        return {
          ...target,
          weight: Math.max(0, Number(row?.actualPacks || 0)),
        };
      });
      totalWeight = targets.reduce((sum, target) => sum + target.weight, 0);
    }
    if (totalWeight <= 0) {
      // Cuối cùng chia đều để không mất chi phí.
      targets = targets.map(target => ({ ...target, weight: 1 }));
      totalWeight = targets.length;
    }
    if (!targets.length) continue;

    const raw = targets.map(target => (amountCents * target.weight) / totalWeight);
    const cents = raw.map(value => Math.round(value));
    let diff = amountCents - cents.reduce((sum, value) => sum + value, 0);
    if (diff !== 0) {
      let largest = 0;
      for (let index = 1; index < targets.length; index++) {
        if (targets[index].actualPacks > targets[largest].actualPacks) largest = index;
      }
      cents[largest] += diff;
    }

    targets.forEach((target, index) => add(target.packagingId, entry, cents[index]));
  }

  return Array.from(totals.entries()).map(([key, cents]) => {
    const [packagingId, costCenterId] = key.split(":").map(Number);
    const entry = entries.find(item => item.costCenterId === costCenterId)!;
    return {
      packagingId,
      costCenterId,
      code: entry.costCenterCode,
      name: entry.costCenterName,
      category: entry.costCenterCategory,
      amount: Math.round(cents) / 100,
    };
  });
}
