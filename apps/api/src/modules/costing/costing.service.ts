import type {
  CostCenterInput,
  CostCenterListQuery,
  CostCenterUpdateInput,
  CostEntryInput,
  CostEntryListQuery,
  CostEntryUpdateInput,
  CostSheetCreateInput,
  CostSheetListQuery,
  ImportIncidentsInput,
  UnbilledIncidentQuery,
} from "@challenge/contracts";
import {
  diffFields,
  recordAudit,
  snapshotFields,
  type AuditChange,
  type AuditField,
} from "../../common/audit";
import { nextDocumentCode, resolveDocumentCode } from "../../common/document-code";
import { HttpError } from "../../common/http-error";
import { reportingRepository } from "../reporting/reporting.repository";
import {
  mapCostCenter,
  mapCostEntry,
  mapCostSheet,
} from "./costing.mapper";
import {
  costingRepository,
  prisma,
} from "./costing.repository";
import { buildAssemblyCostReport } from "./assembly-cost-report";
import { buildProductionCostReport } from "./production-cost-report";

const nowIso = () => new Date().toISOString();
const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);
const dayAfter = (value: string) =>
  new Date(dateOnly(value).getTime() + 86_400_000);
const round2 = (value: number) => Math.round(value * 100) / 100;
const has = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const COST_CENTER_AUDIT: AuditField[] = [
  { key: "name", label: "Tên đối tượng chi phí" },
  { key: "category", label: "Nhóm chi phí" },
  { key: "defaultAllocationMethod", label: "Tiêu thức phân bổ" },
  { key: "description", label: "Mô tả" },
  { key: "isActive", label: "Đang sử dụng" },
];

const COST_ENTRY_AUDIT: AuditField[] = [
  { key: "costDate", label: "Ngày chi phí" },
  { key: "costCenterId", label: "Đối tượng chi phí" },
  { key: "warehouseId", label: "Kho sản xuất" },
  { key: "productionOrderId", label: "Lệnh sản xuất" },
  { key: "assemblyOrderId", label: "Lệnh lắp ráp" },
  { key: "costTier", label: "Tầng chi phí" },
  { key: "incidentId", label: "Sự cố kỹ thuật" },
  { key: "amount", label: "Số tiền" },
  { key: "allocationMethod", label: "Tiêu thức phân bổ" },
  { key: "note", label: "Ghi chú" },
  { key: "status", label: "Trạng thái" },
];

async function ensureCostCenter(id: number, activeOnly = false) {
  const row = activeOnly
    ? await costingRepository.costCenterActive(id)
    : await costingRepository.costCenter(id);
  if (!row) {
    throw new HttpError(
      422,
      "COST_CENTER_NOT_FOUND",
      activeOnly
        ? "Đối tượng chi phí không tồn tại hoặc đã ngừng sử dụng"
        : "Đối tượng chi phí không tồn tại",
    );
  }
  return row;
}

async function ensureWarehouse(id?: number | null) {
  if (!id) return;
  if (!(await costingRepository.warehouse(id))) {
    throw new HttpError(422, "WAREHOUSE_NOT_FOUND", "Kho sản xuất không tồn tại");
  }
}

async function ensureProductionOrder(id?: number | null) {
  if (!id) return;
  const row = await costingRepository.productionOrder(id);
  if (!row) {
    throw new HttpError(422, "PRODUCTION_ORDER_NOT_FOUND", "Lệnh sản xuất không tồn tại");
  }
  return row;
}

async function ensureAssemblyOrder(id?: number | null) {
  if (!id) return;
  const row = await costingRepository.assemblyOrder(id);
  if (!row) {
    throw new HttpError(422, "ASSEMBLY_ORDER_NOT_FOUND", "Lệnh lắp ráp không tồn tại");
  }
  return row;
}

async function ensureIncident(id?: number | null) {
  if (!id) return;
  const row = await prisma.technical_incidents.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!row) {
    throw new HttpError(422, "INCIDENT_NOT_FOUND", "Sự cố kỹ thuật không tồn tại");
  }
}

const mapEntryChanges = (row: any): AuditChange[] =>
  COST_ENTRY_AUDIT.map(field => ({
    field: field.key,
    label: field.label,
    oldValue: null,
    newValue:
      field.key === "costDate"
        ? row.costDate?.toISOString?.().slice(0, 10) ?? null
        : row[field.key],
  }));

function entryWhere(query: CostEntryListQuery) {
  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.costCenterId) where.costCenterId = query.costCenterId;
  if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
  if (query.assemblyOrderId) where.assemblyOrderId = query.assemblyOrderId;
  if (query.costTier) where.costTier = query.costTier;
  if (query.from || query.to) {
    where.costDate = {};
    if (query.from) where.costDate.gte = dateOnly(query.from);
    if (query.to) where.costDate.lt = dayAfter(query.to);
  }
  if (query.search) {
    where.OR = [
      { code: { contains: query.search } },
      { note: { contains: query.search } },
      { costCenter: { code: { contains: query.search } } },
      { costCenter: { name: { contains: query.search } } },
      { productionOrder: { code: { contains: query.search } } },
      { assemblyOrder: { code: { contains: query.search } } },
      { incident: { code: { contains: query.search } } },
    ];
  }
  return where;
}

export const costingService = {
  // ── Cost centers ───────────────────────────────────────────────────────────
  async costCenters(query: CostCenterListQuery) {
    const where: any = {};
    if (query.category) where.category = query.category;
    if (query.isActive === "true") where.isActive = true;
    if (query.isActive === "false") where.isActive = false;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }
    return (await costingRepository.costCenters(where)).map(mapCostCenter);
  },

  async createCostCenter(input: CostCenterInput, userId: number) {
    const existing = await costingRepository.costCenterByCode(input.code);
    if (existing) {
      throw new HttpError(409, "CODE_EXISTS", `Mã ${input.code} đã tồn tại`);
    }
    const row = await costingRepository.costCenterCreate({
      code: input.code,
      name: input.name,
      category: input.category,
      defaultAllocationMethod: input.defaultAllocationMethod,
      description: input.description || null,
      isActive: input.isActive ?? true,
    });
    await recordAudit(prisma, {
      action: "Tạo đối tượng tập hợp chi phí",
      details: `${row.code} - ${row.name}`,
      entityType: "COST_CENTER",
      entityId: row.id,
      entityCode: row.code,
      userId,
      createdAt: nowIso(),
      changes: snapshotFields(row, COST_CENTER_AUDIT),
    });
    return mapCostCenter(row);
  },

  async updateCostCenter(id: number, input: CostCenterUpdateInput, userId: number) {
    const before = await costingRepository.costCenter(id);
    if (!before) {
      throw new HttpError(404, "COST_CENTER_NOT_FOUND", "Không tìm thấy đối tượng chi phí");
    }
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.category !== undefined) data.category = input.category;
    if (input.defaultAllocationMethod !== undefined) {
      data.defaultAllocationMethod = input.defaultAllocationMethod;
    }
    if (input.description !== undefined) data.description = input.description || null;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    const after = await costingRepository.costCenterUpdate(id, data);
    await recordAudit(prisma, {
      action: "Cập nhật đối tượng tập hợp chi phí",
      details: after.code,
      entityType: "COST_CENTER",
      entityId: id,
      entityCode: after.code,
      userId,
      createdAt: nowIso(),
      changes: diffFields(before, after, COST_CENTER_AUDIT),
    });
    return mapCostCenter(after);
  },

  // ── Cost entries ───────────────────────────────────────────────────────────
  async entries(query: CostEntryListQuery) {
    const where = entryWhere(query);
    const [rows, total, sum] = await Promise.all([
      costingRepository.entries(where, (query.page - 1) * query.limit, query.limit),
      costingRepository.entryCount(where),
      costingRepository.entrySum(where),
    ]);
    return {
      data: rows.map(mapCostEntry),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        totalAmount: round2(Number(sum._sum.amount || 0)),
      },
    };
  },

  async entry(id: number) {
    const row = await costingRepository.entry(id);
    if (!row) {
      throw new HttpError(404, "COST_ENTRY_NOT_FOUND", "Không tìm thấy chứng từ chi phí");
    }
    return mapCostEntry(row);
  },

  async createEntry(input: CostEntryInput, userId: number) {
    await ensureCostCenter(input.costCenterId, true);
    await ensureWarehouse(input.warehouseId);
    await ensureProductionOrder(input.productionOrderId);
    await ensureAssemblyOrder(input.assemblyOrderId);
    await ensureIncident(input.incidentId);
    const costTier = input.assemblyOrderId
      ? "ASSEMBLY"
      : input.productionOrderId
        ? "PACK"
        : input.costTier;
    const code = await resolveDocumentCode("cost_entry", input.code);
    const row = await costingRepository.entryCreate({
      code,
      costDate: dateOnly(input.costDate),
      periodMonth: input.costDate.slice(0, 7),
      costCenterId: input.costCenterId,
      warehouseId: input.warehouseId ?? null,
      productionOrderId: input.productionOrderId ?? null,
      assemblyOrderId: input.assemblyOrderId ?? null,
      costTier,
      incidentId: input.incidentId ?? null,
      amount: input.amount,
      allocationMethod: input.allocationMethod || null,
      note: input.note || null,
      status: input.status,
      createdBy: userId,
    });
    await recordAudit(prisma, {
      action: "Tạo chứng từ chi phí sản xuất",
      details: row.code,
      entityType: "COST_ENTRY",
      entityId: row.id,
      entityCode: row.code,
      userId,
      createdAt: nowIso(),
      changes: mapEntryChanges(row),
    });
    return mapCostEntry(row);
  },

  async updateEntry(id: number, input: CostEntryUpdateInput, userId: number) {
    const before = await costingRepository.entry(id);
    if (!before) {
      throw new HttpError(404, "COST_ENTRY_NOT_FOUND", "Không tìm thấy chứng từ chi phí");
    }
    if (input.costCenterId !== undefined) {
      await ensureCostCenter(input.costCenterId, true);
    }
    if (has(input, "warehouseId")) await ensureWarehouse(input.warehouseId);
    if (has(input, "productionOrderId")) {
      await ensureProductionOrder(input.productionOrderId);
    }
    if (has(input, "assemblyOrderId")) {
      await ensureAssemblyOrder(input.assemblyOrderId);
    }
    if (has(input, "incidentId")) await ensureIncident(input.incidentId);

    const data: any = {};
    if (input.costDate !== undefined) {
      data.costDate = dateOnly(input.costDate);
      data.periodMonth = input.costDate.slice(0, 7);
    }
    if (input.costCenterId !== undefined) data.costCenterId = input.costCenterId;
    if (has(input, "warehouseId")) data.warehouseId = input.warehouseId ?? null;
    if (has(input, "productionOrderId")) {
      data.productionOrderId = input.productionOrderId ?? null;
    }
    if (has(input, "assemblyOrderId")) {
      data.assemblyOrderId = input.assemblyOrderId ?? null;
    }
    if (input.costTier !== undefined) data.costTier = input.costTier;
    if (has(input, "incidentId")) data.incidentId = input.incidentId ?? null;
    if (input.amount !== undefined) data.amount = input.amount;
    if (has(input, "allocationMethod")) {
      data.allocationMethod = input.allocationMethod || null;
    }
    if (has(input, "note")) data.note = input.note || null;
    if (input.status !== undefined) data.status = input.status;

    // Đối tượng đích quyết định tầng chi phí để tránh phân bổ trùng.
    const nextProductionOrderId = has(input, "productionOrderId")
      ? input.productionOrderId
      : before.productionOrderId;
    const nextAssemblyOrderId = has(input, "assemblyOrderId")
      ? input.assemblyOrderId
      : before.assemblyOrderId;
    if (nextAssemblyOrderId) {
      data.costTier = "ASSEMBLY";
    } else if (nextProductionOrderId) {
      data.costTier = "PACK";
    }

    const after = await costingRepository.entryUpdate(id, data);
    await recordAudit(prisma, {
      action: "Cập nhật chứng từ chi phí sản xuất",
      details: after.code,
      entityType: "COST_ENTRY",
      entityId: id,
      entityCode: after.code,
      userId,
      createdAt: nowIso(),
      changes: diffFields(before, after, COST_ENTRY_AUDIT),
    });
    return mapCostEntry(after);
  },

  async removeEntry(id: number, userId: number) {
    const before = await costingRepository.entry(id);
    if (!before) {
      throw new HttpError(404, "COST_ENTRY_NOT_FOUND", "Không tìm thấy chứng từ chi phí");
    }
    await costingRepository.entryDelete(id);
    await recordAudit(prisma, {
      action: "Xóa chứng từ chi phí sản xuất",
      details: before.code,
      entityType: "COST_ENTRY",
      entityId: id,
      entityCode: before.code,
      userId,
      createdAt: nowIso(),
      changes: mapEntryChanges(before),
    });
    return null;
  },

  warehouses() {
    return costingRepository.warehouses();
  },

  productionOrders(search?: string) {
    return costingRepository.productionOrders(search);
  },

  assemblyOrders(search?: string) {
    return costingRepository.assemblyOrders(search);
  },

  async unbilledIncidents(query: UnbilledIncidentQuery) {
    const rows = await costingRepository.unbilledIncidents({
      from: query.from ? dateOnly(query.from) : undefined,
      toExclusive: query.to ? dayAfter(query.to) : undefined,
      search: query.search,
      limit: query.limit,
    });
    return rows.map(row => ({
      id: row.id,
      code: row.code,
      title: row.title,
      equipmentName: row.equipmentName || null,
      location: row.location || null,
      status: row.status,
      occurredAt: row.occurredAt?.toISOString?.() || null,
      resolvedAt: row.resolvedAt?.toISOString?.() || null,
      cost: Number(row.cost || 0),
      assigneeName: row.assigneeName || null,
    }));
  },

  async importIncidents(input: ImportIncidentsInput, userId: number) {
    const costCenter = await ensureCostCenter(input.costCenterId, true);
    const incidents = await costingRepository.incidentsByIds(input.incidentIds);
    if (!incidents.length) {
      throw new HttpError(422, "NO_INCIDENT_SELECTED", "Không có sự cố hợp lệ để nhập");
    }
    const linked = await costingRepository.linkedIncidentIds(
      incidents.map(incident => incident.id),
    );
    const linkedIds = new Set(
      linked.map(row => Number(row.incidentId)).filter(Boolean),
    );
    const selected = incidents.filter(
      incident => Number(incident.cost || 0) > 0 && !linkedIds.has(incident.id),
    );
    if (!selected.length) {
      throw new HttpError(
        409,
        "INCIDENTS_ALREADY_POSTED",
        "Các sự cố đã được hạch toán hoặc không có chi phí",
      );
    }

    const startCode = await nextDocumentCode("cost_entry");
    const prefix = startCode.replace(/\d+$/, "");
    const startSequence = Number(startCode.match(/(\d+)$/)?.[1] || 1);

    const created = await prisma.$transaction(async tx => {
      const rows: any[] = [];
      for (let index = 0; index < selected.length; index++) {
        const incident = selected[index];
        const code = `${prefix}${String(startSequence + index).padStart(5, "0")}`;
        const costDate = incident.resolvedAt || incident.occurredAt;
        const row = await tx.production_cost_entries.create({
          data: {
            code,
            costDate: new Date(
              Date.UTC(
                costDate.getUTCFullYear(),
                costDate.getUTCMonth(),
                costDate.getUTCDate(),
              ),
            ),
            periodMonth: costDate.toISOString().slice(0, 7),
            costCenterId: costCenter.id,
            amount: Number(incident.cost || 0),
            note: (input.note || `Sự cố ${incident.code}: ${incident.title}`).slice(0, 500),
            status: input.status,
            createdBy: userId,
          },
        });
        await recordAudit(tx, {
          action: "Nhập chi phí từ sự cố kỹ thuật",
          details: `${row.code} ← ${incident.code}`,
          entityType: "COST_ENTRY",
          entityId: row.id,
          entityCode: row.code,
          userId,
          createdAt: nowIso(),
          changes: [
            {
              field: "incidentId",
              label: "Sự cố kỹ thuật",
              oldValue: null,
              newValue: incident.code,
            },
            {
              field: "amount",
              label: "Số tiền",
              oldValue: null,
              newValue: Number(incident.cost || 0),
            },
          ],
        });
        rows.push(row);
      }
      return rows;
    });

    return {
      created: created.length,
      skipped: incidents.length - selected.length,
      entries: created.map(row => ({
        id: row.id,
        code: row.code,
        amount: Number(row.amount || 0),
      })),
    };
  },

  // ── Cost sheets ────────────────────────────────────────────────────────────
  async createSheet(input: CostSheetCreateInput, userId: number) {
    const from = dateOnly(input.fromDate);
    const toExclusive = dayAfter(input.toDate);
    const [raw, assemblyOrders, entries, orderLines] = await Promise.all([
      reportingRepository.productionOverview({
        from,
        toExclusive,
        warehouseId: input.warehouseId ?? undefined,
      }),
      reportingRepository.assemblyCostOverview({
        from,
        toExclusive,
        warehouseId: input.warehouseId ?? undefined,
      }),
      costingRepository.entriesForAllocation({
        from,
        toExclusive,
        warehouseId: input.warehouseId ?? undefined,
      }),
      costingRepository.orderLinesForAllocation({
        from,
        toExclusive,
        warehouseId: input.warehouseId ?? undefined,
      }),
    ]);
    if (!raw.length && !assemblyOrders.length) {
      throw new HttpError(
        422,
        "NO_PRODUCTION_DATA",
        "Không có lệnh sản xuất hoặc lệnh lắp ráp hoàn thành trong kỳ để chốt giá thành",
      );
    }

    const allocationEntries = entries.map(row => ({
      id: row.id,
      amount: Number(row.amount || 0),
      allocationMethod: row.allocationMethod || null,
      productionOrderId: row.productionOrderId,
      assemblyOrderId: row.assemblyOrderId,
      costTier: row.costTier || "PACK",
      costCenterId: row.costCenterId,
      costCenterCode: row.costCenter?.code || "",
      costCenterName: row.costCenter?.name || "",
      costCenterCategory: row.costCenter?.category || "OTHER",
      costCenterDefaultMethod:
        row.costCenter?.defaultAllocationMethod || "BY_ACTUAL_QTY",
    }));
    const packEntries = allocationEntries.filter(
      entry =>
        entry.costTier !== "ASSEMBLY" || Boolean(entry.productionOrderId),
    );
    const assemblyEntries = allocationEntries.filter(
      entry =>
        entry.costTier === "ASSEMBLY" && !entry.productionOrderId,
    );

    const report = buildProductionCostReport(
      raw,
      packEntries,
      orderLines.map(row => ({
        orderId: Number(row.orderId),
        packagingId: Number(row.packagingId),
        actualPacks: Number(row.actualPacks || 0),
        allocationPercent: Number(row.allocationPercent || 0),
      })),
    );

    const packCosts = new Map(
      report.rows.map(row => [
        row.packagingId,
        {
          unitCost: row.costPerUnit,
          powderPerUnit: row.actualPacks
            ? row.powderKg / row.actualPacks
            : 0,
        },
      ]),
    );
    const assemblyReport = buildAssemblyCostReport(
      assemblyOrders,
      packCosts,
      assemblyEntries,
    );

    const code = await resolveDocumentCode("cost_sheet", "");
    const postedAt = input.status === "POSTED" ? new Date() : null;

    const sheetId = await prisma.$transaction(async tx => {
      const sheet = await tx.product_cost_sheets.create({
        data: {
          code,
          fromDate: from,
          toDate: dateOnly(input.toDate),
          warehouseId: input.warehouseId ?? null,
          status: input.status,
          note: input.note || null,
          createdBy: userId,
          postedAt,
        },
      });
      const lines: any[] = [];
      for (const row of report.rows) {
        if (row.materialValue !== 0) {
          lines.push({
            sheetId: sheet.id,
            packagingId: row.packagingId,
            costCenterId: null,
            costComponent: "MATERIAL",
            tier: "PACK",
            actualQty: row.actualPacks,
            allocatedAmount: row.materialValue,
            unitCost: row.materialCostPerUnit,
          });
        }
        for (const item of row.overheadBreakdown) {
          lines.push({
            sheetId: sheet.id,
            packagingId: row.packagingId,
            costCenterId: item.costCenterId,
            costComponent: item.category,
            tier: "PACK",
            actualQty: row.actualPacks,
            allocatedAmount: item.amount,
            unitCost: row.actualPacks ? item.amount / row.actualPacks : 0,
          });
        }
      }
      for (const row of assemblyReport.rows) {
        const baseLines = [
          {
            component: "PACK_COST",
            amount: row.packValue,
          },
          {
            component: "ASSEMBLY_MATERIAL",
            amount: row.assemblyMaterialValue,
          },
          {
            component: "ASSEMBLY_EXTRA",
            amount: row.assemblyExtraCost,
          },
        ];
        for (const base of baseLines) {
          if (!base.amount) continue;
          lines.push({
            sheetId: sheet.id,
            packagingId: row.packagingId,
            costCenterId: null,
            costComponent: base.component,
            tier: "ASSEMBLY",
            actualQty: row.actualQty,
            allocatedAmount: base.amount,
            unitCost: row.actualQty ? base.amount / row.actualQty : 0,
          });
        }
        for (const item of row.overheadBreakdown) {
          lines.push({
            sheetId: sheet.id,
            packagingId: row.packagingId,
            costCenterId: item.costCenterId,
            costComponent: item.category,
            tier: "ASSEMBLY",
            actualQty: row.actualQty,
            allocatedAmount: item.amount,
            unitCost: row.actualQty ? item.amount / row.actualQty : 0,
          });
        }
      }
      if (lines.length) {
        await tx.product_cost_sheet_lines.createMany({ data: lines });
      }
      await recordAudit(tx, {
        action: "Chốt bảng tính giá thành sản xuất",
        details: `${sheet.code} (${input.fromDate} → ${input.toDate})`,
        entityType: "COST_SHEET",
        entityId: sheet.id,
        entityCode: sheet.code,
        userId,
        createdAt: nowIso(),
        changes: [
          {
            field: "totalCost",
            label: "Tổng giá thành 2 tầng",
            oldValue: null,
            newValue: round2(report.summary.totalCost + assemblyReport.summary.totalCost),
          },
          {
            field: "packTotalCost",
            label: "Giá thành gói sản xuất",
            oldValue: null,
            newValue: report.summary.totalCost,
          },
          {
            field: "assemblyTotalCost",
            label: "Giá thành hộp/túi lắp ráp",
            oldValue: null,
            newValue: assemblyReport.summary.totalCost,
          },
          {
            field: "overheadCost",
            label: "Chi phí phân bổ",
            oldValue: null,
            newValue: round2(
              report.summary.overheadCost + assemblyReport.summary.overheadCost,
            ),
          },
          {
            field: "materialValue",
            label: "Chi phí NVL trực tiếp",
            oldValue: null,
            newValue: report.summary.materialValue,
          },
          {
            field: "lineCount",
            label: "Số dòng giá thành",
            oldValue: null,
            newValue: lines.length,
          },
        ],
      });
      return sheet.id;
    });

    return mapCostSheet(await costingRepository.sheet(sheetId), { detail: true });
  },

  async sheets(query: CostSheetListQuery) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.from || query.to) {
      // Hiển thị mọi bảng tính có kỳ giao với khoảng đang xem,
      // không bắt buộc kỳ bảng tính phải nằm trọn trong khoảng lọc.
      where.AND = [];
      if (query.to) where.AND.push({ fromDate: { lte: dateOnly(query.to) } });
      if (query.from) where.AND.push({ toDate: { gte: dateOnly(query.from) } });
    }
    const [result, total] = await Promise.all([
      costingRepository.sheets(
        where,
        (query.page - 1) * query.limit,
        query.limit,
      ),
      costingRepository.sheetCount(where),
    ]);
    const totals = new Map<
      number,
      { total: number; pack: number; assembly: number }
    >();
    for (const row of result.totals as any[]) {
      const entry = totals.get(row.sheetId) || {
        total: 0,
        pack: 0,
        assembly: 0,
      };
      const amount = Number(row._sum?.allocatedAmount || 0);
      entry.total += amount;
      if ((row.tier || "PACK") === "PACK") entry.pack += amount;
      else if (row.tier === "ASSEMBLY") entry.assembly += amount;
      totals.set(row.sheetId, entry);
    }
    return {
      data: result.rows.map(row => {
        const sums = totals.get(row.id) || { total: 0, pack: 0, assembly: 0 };
        return mapCostSheet({
          ...row,
          _sum: {
            allocatedAmount: sums.total,
            packAllocatedAmount: sums.pack,
            assemblyAllocatedAmount: sums.assembly,
          },
        });
      }),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async sheet(id: number) {
    const row = await costingRepository.sheet(id);
    if (!row) {
      throw new HttpError(404, "COST_SHEET_NOT_FOUND", "Không tìm thấy bảng tính giá thành");
    }
    return mapCostSheet(row, { detail: true });
  },

  async removeSheet(id: number, userId: number) {
    const before = await costingRepository.sheet(id);
    if (!before) {
      throw new HttpError(404, "COST_SHEET_NOT_FOUND", "Không tìm thấy bảng tính giá thành");
    }
    const day = (value: Date | string) => String(value).slice(0, 10);
    await costingRepository.sheetDelete(id);
    await recordAudit(prisma, {
      action: "Xóa bảng tính giá thành sản xuất",
      details: `${before.code} (${day(before.fromDate)} → ${day(before.toDate)})`,
      entityType: "COST_SHEET",
      entityId: id,
      entityCode: before.code,
      userId,
      createdAt: nowIso(),
      changes: [
        {
          field: "code",
          label: "Mã bảng tính",
          oldValue: before.code,
          newValue: null,
        },
        {
          field: "period",
          label: "Kỳ tính giá",
          oldValue: `${day(before.fromDate)} → ${day(before.toDate)}`,
          newValue: null,
        },
        {
          field: "status",
          label: "Trạng thái",
          oldValue: before.status,
          newValue: null,
        },
        {
          field: "lineCount",
          label: "Số dòng giá thành",
          oldValue: before.lines?.length ?? 0,
          newValue: null,
        },
      ],
    });
    return null;
  },
};
