import express from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@challenge/database";
import { mountV1Api } from "../apps/api/src/index";

const stamp = Date.now();
const prefix = `ITCOST2${stamp}`;
const secret = `costing-secret-${stamp}-long`;
const day = "2026-09-03";
process.env.JWT_SECRET = secret;

let userId = 0;
let warehouseId = 0;
let packProductId = 0;
let boxProductId = 0;
let packPackagingId = 0;
let boxPackagingId = 0;
let cartonPackagingId = 0;
let gluePackagingId = 0;
let productionOrderId = 0;
let assemblyOrderId = 0;
const entryIds: number[] = [];
const sheetIds: number[] = [];
let assertions = 0;

const ok = (value: unknown, message: string) => {
  if (!value) throw new Error(`ASSERT ${message}`);
  assertions++;
};
const near = (actual: number, expected: number) =>
  Math.abs(Number(actual) - Number(expected)) < 0.011;

async function cleanup() {
  if (sheetIds.length) {
    await prisma.product_cost_sheets.deleteMany({ where: { id: { in: sheetIds } } });
  }
  if (entryIds.length) {
    await prisma.production_cost_entries.deleteMany({ where: { id: { in: entryIds } } });
    await prisma.audit_logs.deleteMany({
      where: {
        entityType: { in: ["COST_ENTRY", "COST_SHEET"] },
        entityId: { in: entryIds.map(String) },
      },
    });
  }
  if (assemblyOrderId) {
    await prisma.assembly_orders.deleteMany({ where: { id: assemblyOrderId } });
  }
  if (productionOrderId) {
    await prisma.productionorders.deleteMany({ where: { id: productionOrderId } });
  }
  const packagingIds = [
    packPackagingId,
    boxPackagingId,
    cartonPackagingId,
    gluePackagingId,
  ].filter(Boolean);
  if (packagingIds.length) {
    await prisma.productpackagings.deleteMany({ where: { id: { in: packagingIds } } });
  }
  const productIds = [packProductId, boxProductId].filter(Boolean);
  if (productIds.length) {
    await prisma.products.deleteMany({ where: { id: { in: productIds } } });
  }
  if (warehouseId) {
    await prisma.warehouses.deleteMany({ where: { id: warehouseId } });
  }
  if (userId) {
    await prisma.audit_logs.deleteMany({ where: { userId } });
    await prisma.user_roles.deleteMany({ where: { userId } });
    await prisma.users.deleteMany({ where: { id: userId } });
  }
}

async function main() {
  const adminRole = await prisma.roles.findUniqueOrThrow({ where: { code: "ADMIN" } });
  const user = await prisma.users.create({
    data: { username: `${prefix}_admin`, role: "ADMIN", fullName: "Costing IT" },
  });
  userId = user.id;
  await prisma.user_roles.create({ data: { userId, roleId: adminRole.id } });

  const center = await prisma.cost_centers.findFirstOrThrow({
    where: { code: "DIEN_NUOC" },
  });
  const packagingCenter = await prisma.cost_centers.findFirstOrThrow({
    where: { code: "HOP_KEO_THUNG" },
  });
  const maintenanceCenter = await prisma.cost_centers.findFirstOrThrow({
    where: { code: "BAO_DUONG" },
  });

  const warehouse = await prisma.warehouses.create({
    data: { name: `${prefix} Warehouse`, type: "MAIN" },
  });
  warehouseId = warehouse.id;

  const packProduct = await prisma.products.create({
    data: { sku: `${prefix}-PACKP`, name: `${prefix} Pack Product`, category: "PRODUCT" },
  });
  const boxProduct = await prisma.products.create({
    data: { sku: `${prefix}-BOXP`, name: `${prefix} Box Product`, category: "PRODUCT" },
  });
  packProductId = packProduct.id;
  boxProductId = boxProduct.id;

  const pack = await prisma.productpackagings.create({
    data: {
      productId: packProduct.id,
      name: `${prefix} Gói 20g`,
      sku: `${prefix}-PACK`,
      unit: "Gói",
      packCount: 1,
      netWeight: 0.02,
    },
  });
  const box = await prisma.productpackagings.create({
    data: {
      productId: boxProduct.id,
      name: `${prefix} Hộp 6 gói`,
      sku: `${prefix}-BOX6`,
      unit: "Hộp",
      packCount: 6,
    },
  });
  const carton = await prisma.productpackagings.create({
    data: {
      productId: boxProduct.id,
      name: `${prefix} Thùng carton`,
      sku: `${prefix}-CARTON`,
      unit: "Thùng",
      packCount: 1,
    },
  });
  const glue = await prisma.productpackagings.create({
    data: {
      productId: boxProduct.id,
      name: `${prefix} Keo dán`,
      sku: `${prefix}-GLUE`,
      unit: "Kg",
      packCount: 1,
    },
  });
  packPackagingId = pack.id;
  boxPackagingId = box.id;
  cartonPackagingId = carton.id;
  gluePackagingId = glue.id;

  const productionOrder = await prisma.productionorders.create({
    data: {
      code: `${prefix}-PROD`,
      productId: packProduct.id,
      warehouseId,
      sourceModule: "PRODUCTION_V1",
      status: "COMPLETED",
      order_date: day,
      total_powder_kg: 2,
      target_sachets: 100,
      completedAt: new Date(`${day}T10:00:00Z`),
      createdBy: userId,
      productiondetails: {
        create: {
          packagingId: pack.id,
          quantity: 100,
          actual_quantity: 100,
          allocation_percent: 100,
        },
      },
      production_order_materials_v1: {
        create: {
          packagingId: pack.id,
          plannedQuantity: 100,
          actualQuantity: 100,
          unitCost: 10,
          totalValue: 1000,
        },
      },
    },
  });
  productionOrderId = productionOrder.id;

  const assemblyOrder = await prisma.assembly_orders.create({
    data: {
      code: `${prefix}-ASM`,
      orderDate: new Date(day),
      outputPackagingId: box.id,
      plannedQuantity: 10,
      actualQuantity: 10,
      componentWarehouseId: warehouseId,
      outputWarehouseId: warehouseId,
      bomCode: `${prefix}-BOM`,
      bomVersion: 1,
      assemblyCost: 50,
      status: "POSTED",
      sourceModule: "ASSEMBLY_V1",
      postedAt: new Date(`${day}T11:00:00Z`),
      createdBy: userId,
      lines: {
        create: [
          {
            componentPackagingId: pack.id,
            plannedQuantity: 60,
            actualQuantity: 60,
            unitCost: 5,
            totalValue: 300,
          },
          {
            componentPackagingId: carton.id,
            plannedQuantity: 10,
            actualQuantity: 10,
            unitCost: 2,
            totalValue: 20,
          },
          {
            componentPackagingId: glue.id,
            plannedQuantity: 1,
            actualQuantity: 1,
            unitCost: 30,
            totalValue: 30,
          },
        ],
      },
    },
  });
  assemblyOrderId = assemblyOrder.id;

  const app = express();
  app.use(express.json());
  await mountV1Api(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("integration port");
  const base = `http://127.0.0.1:${address.port}`;
  const token = jwt.sign({ sub: userId, type: "access" }, secret);

  const request = async (
    path: string,
    options: { method?: string; body?: unknown; auth?: string | null } = {},
  ) => {
    const { method = "GET", body, auth = token } = options;
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };

  try {
    const reportUrl = `/api/v1/reports/production-overview?from=${day}&to=${day}&warehouseId=${warehouseId}&search=${prefix}&tier=ALL`;

    let created = await request("/api/v1/costing/entries", {
      method: "POST",
      body: {
        costDate: day,
        costCenterId: center.id,
        warehouseId,
        costTier: "PACK",
        amount: 500,
      },
    });
    ok(created.status === 201, "create pack period cost");
    entryIds.push(created.body.data.id);
    ok(created.body.data.costTier === "PACK", "pack entry tier");
    ok(created.body.data.code.startsWith("CP"), "cost entry code prefix");

    created = await request("/api/v1/costing/entries", {
      method: "POST",
      body: {
        costDate: day,
        costCenterId: packagingCenter.id,
        warehouseId,
        costTier: "ASSEMBLY",
        amount: 200,
      },
    });
    ok(created.status === 201, "create assembly period cost");
    entryIds.push(created.body.data.id);
    ok(created.body.data.costTier === "ASSEMBLY", "assembly period tier");

    created = await request("/api/v1/costing/entries", {
      method: "POST",
      body: {
        costDate: day,
        costCenterId: maintenanceCenter.id,
        warehouseId,
        assemblyOrderId,
        amount: 100,
      },
    });
    ok(created.status === 201, "create direct assembly cost");
    entryIds.push(created.body.data.id);
    ok(created.body.data.costTier === "ASSEMBLY", "direct assembly forces tier");
    ok(created.body.data.assemblyOrderId === assemblyOrderId, "assembly order stored");

    const bothTargets = await request("/api/v1/costing/entries", {
      method: "POST",
      body: {
        costDate: day,
        costCenterId: center.id,
        productionOrderId,
        assemblyOrderId,
        amount: 10,
      },
    });
    ok(bothTargets.status === 422, "reject both production and assembly target");

    let report = await request(reportUrl);
    ok(report.status === 200, "report success");
    const data = report.body.data;
    ok(data.tier === "ALL", "tier echoed");
    ok(Array.isArray(data.rows) && Array.isArray(data.assembly?.rows), "two tier payload");

    const packRow = data.rows.find((row: any) => row.packagingId === packPackagingId);
    ok(Boolean(packRow), "pack row present");
    ok(near(packRow.actualPacks, 100), "pack actual qty");
    ok(near(packRow.materialValue, 1000), "pack material value");
    ok(near(packRow.powderKg, 2), "pack powder kg");
    ok(near(packRow.overheadCost, 500), "pack overhead");
    ok(near(packRow.totalCost, 1500), "pack total cost");
    ok(near(packRow.costPerUnit, 15), "pack cost per unit");

    const boxRow = data.assembly.rows.find(
      (row: any) => row.packagingId === boxPackagingId,
    );
    ok(Boolean(boxRow), "assembly row present");
    ok(near(boxRow.actualQty, 10), "assembly actual qty");
    ok(near(boxRow.packValue, 900), "assembly carries tier1 pack cost");
    ok(near(boxRow.assemblyMaterialValue, 50), "assembly packaging materials");
    ok(near(boxRow.assemblyExtraCost, 50), "assembly extra cost");
    ok(near(boxRow.externalCost, 1000), "assembly external cost");
    ok(near(boxRow.overheadCost, 300), "assembly overhead");
    ok(near(boxRow.totalCost, 1300), "assembly total cost");
    ok(near(boxRow.costPerUnit, 130), "assembly cost per unit");
    ok(boxRow.inventoryValue === 50, "inventory-sourced materials value (carton + glue)");
    const packComponent = boxRow.components.find(
      (item: any) => item.packagingId === packPackagingId,
    );
    ok(packComponent?.source === "PRODUCTION", "pack component uses production cost");
    const cartonComponent = boxRow.components.find(
      (item: any) => item.packagingId === cartonPackagingId,
    );
    ok(cartonComponent?.source === "INVENTORY", "carton uses inventory cost");

    ok(near(data.summary.overheadCost, 500), "pack summary overhead");
    ok(near(data.assembly.summary.overheadCost, 300), "assembly summary overhead");
    ok(near(data.assembly.summary.totalCost, 1300), "assembly summary total");

    let list = await request(
      `/api/v1/costing/entries?from=${day}&to=${day}&costTier=ASSEMBLY`,
    );
    ok(list.status === 200, "entry list by tier");
    ok(list.body.data.length === 2, "two assembly entries");
    list = await request(`/api/v1/costing/entries?assemblyOrderId=${assemblyOrderId}`);
    ok(list.body.data.length === 1, "entry list by assembly order");

    const orders = await request(
      `/api/v1/costing/assembly-orders?search=${prefix}`,
    );
    ok(orders.status === 200, "assembly order lookup");
    ok(
      orders.body.data.some((row: any) => row.id === assemblyOrderId),
      "assembly order returned",
    );

    const sheet = await request("/api/v1/costing/sheets", {
      method: "POST",
      body: {
        fromDate: day,
        toDate: day,
        warehouseId,
        status: "POSTED",
      },
    });
    ok(sheet.status === 201, "create cost sheet");
    sheetIds.push(sheet.body.data.id);
    ok(near(sheet.body.data.totalPackCost, 1500), "sheet pack total");
    ok(near(sheet.body.data.totalAssemblyCost, 1300), "sheet assembly total");
    ok(near(sheet.body.data.totalCost, 2800), "sheet gross total");
    const tiers = new Set((sheet.body.data.lines || []).map((line: any) => line.tier));
    ok(tiers.has("PACK") && tiers.has("ASSEMBLY"), "sheet snapshots both tiers");
    const packSnap = (sheet.body.data.lines || []).find(
      (line: any) => line.tier === "PACK" && line.packagingId === packPackagingId,
    );
    const assemblySnap = (sheet.body.data.lines || []).find(
      (line: any) => line.tier === "ASSEMBLY" && line.packagingId === boxPackagingId,
    );
    ok(Boolean(packSnap) && Boolean(assemblySnap), "sheet has both tier lines");

    console.log(`COSTING_TWO_TIER_INTEGRATION_OK assertions=${assertions}`);
  } finally {
    server.close();
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
      console.log(
        `COSTING_TWO_TIER_FIXTURE_CLEANED residue=${await prisma.production_cost_entries.count({ where: { code: { startsWith: "CP" }, createdBy: userId } })}`,
      );
    } finally {
      await prisma.$disconnect();
    }
  });
