import { Prisma, prisma } from "@challenge/database";

const warehouseSelect = { id: true, code: true, name: true } as const;
const orderSelect = { id: true, code: true, warehouseId: true } as const;
const assemblyOrderSelect = {
  id: true,
  code: true,
  status: true,
  orderDate: true,
  actualQuantity: true,
} as const;
const incidentSelect = {
  id: true,
  code: true,
  title: true,
  equipmentName: true,
  occurredAt: true,
  resolvedAt: true,
} as const;
const creatorSelect = { id: true, username: true, fullName: true } as const;

export const costEntryInclude = {
  costCenter: true,
  warehouse: { select: warehouseSelect },
  productionOrder: { select: orderSelect },
  assemblyOrder: { select: assemblyOrderSelect },
  incident: { select: incidentSelect },
  creator: { select: creatorSelect },
} satisfies Prisma.production_cost_entriesInclude;

const sheetInclude = {
  warehouse: { select: warehouseSelect },
  creator: { select: creatorSelect },
  _count: { select: { lines: true } },
} satisfies Prisma.product_cost_sheetsInclude;

export const costingRepository = {
  // ── Cost centers ───────────────────────────────────────────────────────────
  costCenters(where: Prisma.cost_centersWhereInput) {
    return prisma.cost_centers.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    });
  },
  costCenter(id: number) {
    return prisma.cost_centers.findUnique({ where: { id } });
  },
  costCenterByCode(code: string) {
    return prisma.cost_centers.findUnique({ where: { code } });
  },
  costCenterCreate(data: Prisma.cost_centersCreateInput) {
    return prisma.cost_centers.create({ data });
  },
  costCenterUpdate(id: number, data: Prisma.cost_centersUpdateInput) {
    return prisma.cost_centers.update({ where: { id }, data });
  },
  costCenterActive(id: number) {
    return prisma.cost_centers.findFirst({ where: { id, isActive: true } });
  },

  // ── Cost entries ───────────────────────────────────────────────────────────
  entries(where: Prisma.production_cost_entriesWhereInput, skip: number, take: number) {
    return prisma.production_cost_entries.findMany({
      where,
      include: costEntryInclude,
      orderBy: [{ costDate: "desc" }, { id: "desc" }],
      skip,
      take,
    });
  },
  entryCount(where: Prisma.production_cost_entriesWhereInput) {
    return prisma.production_cost_entries.count({ where });
  },
  entry(id: number) {
    return prisma.production_cost_entries.findUnique({
      where: { id },
      include: costEntryInclude,
    });
  },
  entryCreate(data: Prisma.production_cost_entriesUncheckedCreateInput) {
    return prisma.production_cost_entries.create({ data, include: costEntryInclude });
  },
  entryUpdate(id: number, data: Prisma.production_cost_entriesUncheckedUpdateInput) {
    return prisma.production_cost_entries.update({
      where: { id },
      data,
      include: costEntryInclude,
    });
  },
  entryDelete(id: number) {
    return prisma.production_cost_entries.delete({ where: { id } });
  },
  entrySum(where: Prisma.production_cost_entriesWhereInput) {
    return prisma.production_cost_entries.aggregate({
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });
  },

  entriesForAllocation(query: {
    from: Date;
    toExclusive: Date;
    warehouseId?: number | null;
  }) {
    return prisma.production_cost_entries.findMany({
      where: {
        status: "POSTED",
        costDate: { gte: query.from, lt: query.toExclusive },
        ...(query.warehouseId
          ? { OR: [{ warehouseId: query.warehouseId }, { warehouseId: null }] }
          : {}),
      },
      include: { costCenter: true },
      orderBy: { id: "asc" },
    });
  },

  orderLinesForAllocation(query: {
    from: Date;
    toExclusive: Date;
    warehouseId?: number | null;
  }) {
    const clauses = [
      "po.sourceModule='PRODUCTION_V1'",
      "po.status='COMPLETED'",
      "po.completedAt>=?",
      "po.completedAt<?",
    ];
    const params: unknown[] = [query.from, query.toExclusive];
    if (query.warehouseId) {
      clauses.push("po.warehouseId=?");
      params.push(query.warehouseId);
    }
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT pd.orderId, pd.packagingId,
        COALESCE(SUM(pd.actual_quantity),0) actualPacks,
        COALESCE(MAX(pd.allocation_percent),0) allocationPercent
      FROM productiondetails pd
      JOIN productionorders po ON po.id=pd.orderId
      WHERE ${clauses.join(" AND ")}
      GROUP BY pd.orderId, pd.packagingId`,
      ...params,
    );
  },

  warehouses() {
    return prisma.warehouses.findMany({
      where: { isActive: 1 },
      select: warehouseSelect,
      orderBy: { name: "asc" },
    });
  },
  warehouse(id: number) {
    return prisma.warehouses.findUnique({ where: { id }, select: warehouseSelect });
  },
  productionOrder(id: number) {
    return prisma.productionorders.findUnique({
      where: { id },
      select: { id: true, code: true, status: true },
    });
  },
  assemblyOrder(id: number) {
    return prisma.assembly_orders.findUnique({
      where: { id },
      select: { id: true, code: true, status: true },
    });
  },
  assemblyOrders(search?: string) {
    return prisma.assembly_orders.findMany({
      where: {
        sourceModule: "ASSEMBLY_V1",
        status: { in: ["DRAFT", "POSTED", "COMPLETED"] },
        ...(search
          ? {
              OR: [
                { code: { contains: search } },
                { output: { name: { contains: search } } },
                { output: { sku: { contains: search } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        status: true,
        orderDate: true,
        actualQuantity: true,
        outputUnitCost: true,
        output: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
            products: { select: { name: true } },
          },
        },
      },
      orderBy: [{ orderDate: "desc" }, { id: "desc" }],
      take: 200,
    });
  },
  productionOrders(search?: string) {
    return prisma.productionorders.findMany({
      where: {
        sourceModule: "PRODUCTION_V1",
        ...(search
          ? {
              OR: [
                { code: { contains: search } },
                { products: { name: { contains: search } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        status: true,
        completedAt: true,
        products: { select: { name: true } },
      },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      take: 200,
    });
  },

  // ── Unbilled technical incidents ───────────────────────────────────────────
  unbilledIncidents(query: {
    from?: Date;
    toExclusive?: Date;
    search?: string;
    limit: number;
  }) {
    return prisma.technical_incidents.findMany({
      where: {
        deletedAt: null,
        cost: { gt: 0 },
        cost_entries: { none: { status: { not: "CANCELLED" } } },
        ...(query.from || query.toExclusive
          ? {
              occurredAt: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.toExclusive ? { lt: query.toExclusive } : {}),
              },
            }
          : {}),
        ...(query.search
          ? {
              OR: [
                { code: { contains: query.search } },
                { title: { contains: query.search } },
                { equipmentName: { contains: query.search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        title: true,
        equipmentName: true,
        location: true,
        status: true,
        occurredAt: true,
        resolvedAt: true,
        cost: true,
        assigneeName: true,
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: query.limit,
    });
  },
  incidentsByIds(ids: number[]) {
    return prisma.technical_incidents.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        code: true,
        title: true,
        cost: true,
        occurredAt: true,
        resolvedAt: true,
      },
    });
  },
  linkedIncidentIds(ids: number[]) {
    return prisma.production_cost_entries.findMany({
      where: { incidentId: { in: ids }, status: { not: "CANCELLED" } },
      select: { incidentId: true },
    });
  },

  // ── Cost sheets ────────────────────────────────────────────────────────────
  async sheets(where: Prisma.product_cost_sheetsWhereInput, skip: number, take: number) {
    const rows = await prisma.product_cost_sheets.findMany({
      where,
      include: sheetInclude,
      orderBy: [{ fromDate: "desc" }, { id: "desc" }],
      skip,
      take,
    });
    const totals = rows.length
      ? await prisma.product_cost_sheet_lines.groupBy({
          by: ["sheetId", "tier"],
          where: { sheetId: { in: rows.map(row => row.id) } },
          _sum: { allocatedAmount: true },
        })
      : [];
    return { rows, totals };
  },
  sheetCount(where: Prisma.product_cost_sheetsWhereInput) {
    return prisma.product_cost_sheets.count({ where });
  },
  sheetDelete(id: number) {
    return prisma.product_cost_sheets.delete({ where: { id } });
  },
  sheet(id: number) {
    return prisma.product_cost_sheets.findUnique({
      where: { id },
      include: {
        warehouse: { select: warehouseSelect },
        creator: { select: creatorSelect },
        lines: {
          include: {
            costCenter: true,
            packaging: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit: true,
                products: { select: { name: true } },
              },
            },
          },
          orderBy: [{ packagingId: "asc" }, { costComponent: "asc" }],
        },
      },
    });
  },
};

export { prisma };
