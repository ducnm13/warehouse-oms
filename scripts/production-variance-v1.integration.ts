import express from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@challenge/database";
import { mountV1Api } from "../apps/api/src/index";

const stamp = Date.now(), prefix = `ITVAR${stamp}`, secret = `variance-secret-${stamp}-long`, day = "2026-09-03";
process.env.JWT_SECRET = secret;
let adminId = 0, deniedId = 0, warehouseId = 0, otherWarehouseId = 0, outputProductId = 0, materialProductId = 0;
let outputPackagingId = 0, materialPackaging1Id = 0, materialPackaging2Id = 0;
const orderIds: number[] = [];
let assertions = 0;
const ok = (value: unknown, message: string) => { if (!value) throw new Error(`ASSERT ${message}`); assertions++; };
const near = (actual: number, expected: number) => Math.abs(actual - expected) < .011;

async function cleanup() {
  if (orderIds.length) await prisma.productionorders.deleteMany({ where: { id: { in: orderIds } } });
  const packagingIds = [outputPackagingId, materialPackaging1Id, materialPackaging2Id].filter(Boolean);
  if (packagingIds.length) await prisma.productpackagings.deleteMany({ where: { id: { in: packagingIds } } });
  const productIds = [outputProductId, materialProductId].filter(Boolean);
  if (productIds.length) await prisma.products.deleteMany({ where: { id: { in: productIds } } });
  const warehouseIds = [warehouseId, otherWarehouseId].filter(Boolean);
  if (warehouseIds.length) await prisma.warehouses.deleteMany({ where: { id: { in: warehouseIds } } });
  const userIds = [adminId, deniedId].filter(Boolean);
  if (userIds.length) {
    await prisma.user_roles.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.users.deleteMany({ where: { id: { in: userIds } } });
  }
}

async function main() {
  const adminRole = await prisma.roles.findUniqueOrThrow({ where: { code: "ADMIN" } });
  const admin = await prisma.users.create({ data: { username: `${prefix}_admin`, role: "ADMIN", fullName: "Variance IT" } });
  const denied = await prisma.users.create({ data: { username: `${prefix}_denied`, role: "NONE", fullName: "Variance Denied" } });
  adminId = admin.id; deniedId = denied.id;
  await prisma.user_roles.create({ data: { userId: admin.id, roleId: adminRole.id } });
  const warehouse = await prisma.warehouses.create({ data: { name: `${prefix} Warehouse`, type: "MAIN" } });
  const otherWarehouse = await prisma.warehouses.create({ data: { name: `${prefix} Other Warehouse`, type: "SUB" } });
  warehouseId = warehouse.id; otherWarehouseId = otherWarehouse.id;
  const outputProduct = await prisma.products.create({ data: { sku: `${prefix}-OUTPUT`, name: `${prefix} Output`, category: "PRODUCT" } });
  const materialProduct = await prisma.products.create({ data: { sku: `${prefix}-MAT`, name: `${prefix} Material`, category: "MATERIAL" } });
  outputProductId = outputProduct.id; materialProductId = materialProduct.id;
  const outputPackaging = await prisma.productpackagings.create({ data: { productId: outputProduct.id, name: "Carton", sku: `${prefix}-CARTON`, unit: "Thùng", packCount: 10 } });
  const material1 = await prisma.productpackagings.create({ data: { productId: materialProduct.id, name: "Material A", sku: `${prefix}-A`, unit: "Kg" } });
  const material2 = await prisma.productpackagings.create({ data: { productId: materialProduct.id, name: "Material B", sku: `${prefix}-B`, unit: "Lít" } });
  outputPackagingId = outputPackaging.id; materialPackaging1Id = material1.id; materialPackaging2Id = material2.id;
  const completed = await prisma.productionorders.create({ data: {
    code: `${prefix}-COMPLETED`, productId: outputProduct.id, warehouseId, sourceModule: "PRODUCTION_V1", status: "COMPLETED",
    order_date: day, target_sachets: 100, completedAt: new Date(`${day}T10:00:00Z`), createdBy: admin.id,
    productiondetails: { create: { packagingId: outputPackaging.id, quantity: 10, actual_quantity: 9, unitCost: 12, totalValue: 108 } },
    production_order_materials_v1: { create: [
      { packagingId: material1.id, plannedQuantity: 20, actualQuantity: 22, unitCost: 5, totalValue: 110 },
      { packagingId: material2.id, plannedQuantity: 10, actualQuantity: 8, unitCost: 3, totalValue: 24 },
    ] },
  } });
  const cancelled = await prisma.productionorders.create({ data: {
    code: `${prefix}-CANCELLED`, productId: outputProduct.id, warehouseId, sourceModule: "PRODUCTION_V1", status: "CANCELLED",
    order_date: day, target_sachets: 100, completedAt: new Date(`${day}T11:00:00Z`), createdBy: admin.id,
    productiondetails: { create: { packagingId: outputPackaging.id, quantity: 10, actual_quantity: 20 } },
    production_order_materials_v1: { create: { packagingId: material1.id, plannedQuantity: 20, actualQuantity: 99, unitCost: 5, totalValue: 495 } },
  } });
  orderIds.push(completed.id, cancelled.id);

  const app = express(); app.use(express.json()); await mountV1Api(app);
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("integration port");
  const base = `http://127.0.0.1:${address.port}`, token = jwt.sign({ sub: admin.id, type: "access" }, secret), deniedToken = jwt.sign({ sub: denied.id, type: "access" }, secret);
  const get = async (path: string, auth: string | null = token) => { const response = await fetch(base + path, { headers: auth ? { Authorization: `Bearer ${auth}` } : {} }); return { status: response.status, body: await response.json() }; };

  try {
    ok((await get(`/api/v1/reports/production-variance?from=${day}&to=${day}`, null)).status === 401, "authentication required");
    ok((await get(`/api/v1/reports/production-variance?from=${day}&to=${day}`, deniedToken)).status === 403, "RBAC denied");
    let response = await get(`/api/v1/reports/production-variance?from=${day}&to=${day}&warehouseId=${warehouseId}&search=${prefix}`);
    ok(response.status === 200, "variance endpoint success");
    ok(response.body.data.rows.length === 2 && response.body.data.rows.every((row: any) => row.orderId === completed.id), "completed only and cancelled excluded");
    const over = response.body.data.rows.find((row: any) => row.packagingId === material1.id), under = response.body.data.rows.find((row: any) => row.packagingId === material2.id);
    ok(near(over.plannedOutput, 100) && near(over.actualOutput, 90) && near(over.outputVariance, -10) && near(over.outputVariancePercent, -10), "canonical converted output variance");
    ok(near(over.materialQuantityVariance, 2) && near(over.materialVariancePercent, 10), "over-consumption quantity variance");
    ok(near(over.plannedMaterialValue, 100) && near(over.actualMaterialValue, 110) && near(over.materialValueVariance, 10), "over-consumption value variance");
    ok(near(under.materialQuantityVariance, -2) && near(under.materialVariancePercent, -20), "under-consumption quantity variance");
    ok(near(under.plannedMaterialValue, 30) && near(under.actualMaterialValue, 24) && near(under.materialValueVariance, -6), "under-consumption value variance");
    const summary = response.body.data.summary;
    ok(summary.orders === 1 && near(summary.plannedOutput, 100) && near(summary.actualOutput, 90) && near(summary.outputVariance, -10), "order summary counted once");
    ok(summary.materialLines === 2 && summary.overConsumedLines === 1 && summary.underConsumedLines === 1, "material line classification summary");
    ok(near(summary.plannedMaterialValue, 130) && near(summary.actualMaterialValue, 134) && near(summary.materialValueVariance, 4), "material value summary");
    response = await get(`/api/v1/reports/production-variance?from=${day}&to=${day}&warehouseId=${otherWarehouseId}`);
    ok(response.status === 200 && response.body.data.rows.length === 0, "warehouse filter");
    response = await get(`/api/v1/reports/production-variance?from=${day}&to=${day}&search=DOES_NOT_EXIST`);
    ok(response.status === 200 && response.body.data.rows.length === 0, "search filter");
    ok((await get("/api/v1/reports/production-variance?from=2026-09-04&to=2026-09-03")).status === 422, "date range validation");
    console.log(`PRODUCTION_VARIANCE_INTEGRATION_OK assertions=${assertions}`);
  } finally { server.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try { await cleanup(); console.log(`PRODUCTION_VARIANCE_FIXTURE_CLEANED residue=${await prisma.productionorders.count({ where: { code: { startsWith: prefix } } })}`); }
  finally { await prisma.$disconnect(); }
});