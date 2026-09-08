import express from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@challenge/database";
import { mountV1Api } from "../apps/api/src/index";

const stamp = Date.now();
const prefix = `ITRETURN${stamp}`;
const secret = `sales-return-secret-${stamp}-long`;
const day = "2026-09-03";
process.env.JWT_SECRET = secret;

let adminId = 0, deniedUserId = 0, warehouseId = 0, customerId = 0;
let saleProductId = 0, giftProductId = 0, salePackagingId = 0, giftPackagingId = 0, salesOrderId = 0;
const returnIds: number[] = [];
const receiptIds: bigint[] = [];
let assertions = 0;

const ok = (value: unknown, message: string) => {
  if (!value) throw new Error(`ASSERT ${message}`);
  assertions++;
};
const near = (actual: number, expected: number) => Math.abs(actual - expected) < 0.011;

async function cleanup() {
  const links = returnIds.length ? await prisma.sales_return_document_links.findMany({
    where: { salesReturnId: { in: returnIds }, linkType: { in: ["INVENTORY_RECEIPT", "INVENTORY_REVERSAL"] } },
    select: { linkedId: true },
  }) : [];
  const inventoryIds = links.map(link => Number(link.linkedId));
  await prisma.inventory_ledger.deleteMany({ where: { sourceType: { in: ["SALES_RETURN", "SALES_RETURN_CANCEL"] }, sourceId: { in: returnIds } } });
  await prisma.receivable_transactions.deleteMany({ where: { sourceId: salesOrderId || -1 } });
  if (receiptIds.length) {
    await prisma.payment_receipt_allocations.deleteMany({ where: { paymentReceiptId: { in: receiptIds } } });
    await prisma.payment_receipts.deleteMany({ where: { id: { in: receiptIds } } });
  }
  await prisma.customer_payments.deleteMany({ where: { salesOrderId: salesOrderId || -1 } });
  if (returnIds.length) await prisma.sales_returns.deleteMany({ where: { id: { in: returnIds } } });
  if (inventoryIds.length) {
    await prisma.inventorytransactiondetails.deleteMany({ where: { transactionId: { in: inventoryIds } } });
    await prisma.inventorytransactions.deleteMany({ where: { id: { in: inventoryIds } } });
  }
  if (salesOrderId) await prisma.sales_orders.deleteMany({ where: { id: salesOrderId } });
  const packagingIds = [salePackagingId, giftPackagingId].filter(Boolean);
  if (packagingIds.length) {
    await prisma.productwarehouses.deleteMany({ where: { packagingId: { in: packagingIds } } });
    await prisma.productpackagings.deleteMany({ where: { id: { in: packagingIds } } });
  }
  const productIds = [saleProductId, giftProductId].filter(Boolean);
  if (productIds.length) await prisma.products.deleteMany({ where: { id: { in: productIds } } });
  if (customerId) await prisma.customers.deleteMany({ where: { id: customerId } });
  if (warehouseId) await prisma.warehouses.deleteMany({ where: { id: warehouseId } });
  const userIds = [adminId, deniedUserId].filter(Boolean);
  if (userIds.length) {
    await prisma.audit_logs.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user_roles.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.users.deleteMany({ where: { id: { in: userIds } } });
  }
}

async function main() {
  const adminRole = await prisma.roles.findUniqueOrThrow({ where: { code: "ADMIN" } });
  const admin = await prisma.users.create({ data: { username: `${prefix}_admin`, role: "ADMIN", fullName: "Sales Return IT" } });
  const denied = await prisma.users.create({ data: { username: `${prefix}_denied`, role: "NONE", fullName: "Denied IT" } });
  adminId = admin.id; deniedUserId = denied.id;
  await prisma.user_roles.create({ data: { userId: admin.id, roleId: adminRole.id } });
  const warehouse = await prisma.warehouses.create({ data: { name: `${prefix} Warehouse`, type: "MAIN" } });
  warehouseId = warehouse.id;
  const customer = await prisma.customers.create({ data: { code: `${prefix}-CUS`, name: `${prefix} Customer` } });
  customerId = customer.id;
  const saleProduct = await prisma.products.create({ data: { sku: `${prefix}-SALE`, name: "Return Sale Item", category: "PRODUCT" } });
  const giftProduct = await prisma.products.create({ data: { sku: `${prefix}-GIFT`, name: "Return Promotion Item", category: "PRODUCT" } });
  saleProductId = saleProduct.id; giftProductId = giftProduct.id;
  const salePackaging = await prisma.productpackagings.create({ data: { productId: saleProduct.id, name: "Box", sku: `${prefix}-SALE-BOX`, unit: "Box" } });
  const giftPackaging = await prisma.productpackagings.create({ data: { productId: giftProduct.id, name: "Gift", sku: `${prefix}-GIFT-BOX`, unit: "Gift" } });
  salePackagingId = salePackaging.id; giftPackagingId = giftPackaging.id;
  await prisma.productwarehouses.createMany({ data: [
    { packagingId: salePackaging.id, warehouseId, stock_quantity: 90 },
    { packagingId: giftPackaging.id, warehouseId, stock_quantity: 95 },
  ] });
  const sale = await prisma.sales_orders.create({ data: {
    code: `${prefix}-SALE`, orderDate: day, dueDate: day, customerId, warehouseId, status: "FULFILLED",
    subtotal: 900, discountAmount: 100, taxAmount: 90, totalAmount: 990, paidAmount: 0,
    paymentStatus: "UNPAID", paymentIntent: "UNPAID", createdBy: admin.id, postedAt: new Date(`${day}T08:00:00Z`),
    sales_order_details: { create: [
      { packagingId: salePackaging.id, quantity: 10, unitPrice: 100, discountRate: 10, lineTotal: 900, unitCost: 50, costAmount: 500, lineType: "SALE" },
      { packagingId: giftPackaging.id, quantity: 5, unitPrice: 0, discountRate: 0, lineTotal: 0, unitCost: 20, costAmount: 100, lineType: "PROMOTION", promotionCode: `${prefix}-PROMO`, promotionName: "Fixture Promotion" },
    ] },
  }, include: { sales_order_details: true } });
  salesOrderId = sale.id;
  await prisma.receivable_transactions.create({ data: {
    customerId, sourceType: "SALE", sourceId: sale.id, sourceCode: sale.code, entryType: "CHARGE",
    amount: 990, dueDate: new Date(`${day}T12:00:00Z`), occurredAt: new Date(`${day}T08:00:00Z`), createdBy: admin.id,
  } });
  const saleLine = sale.sales_order_details.find(line => line.lineType === "SALE")!;
  const giftLine = sale.sales_order_details.find(line => line.lineType === "PROMOTION")!;

  const app = express();
  app.use(express.json());
  await mountV1Api(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Không lấy được integration port");
  const base = `http://127.0.0.1:${address.port}`;
  const adminToken = jwt.sign({ sub: admin.id, type: "access" }, secret);
  const deniedToken = jwt.sign({ sub: denied.id, type: "access" }, secret);
  const request = async (path: string, method = "GET", body?: unknown, token: string | null = adminToken) => {
    const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() };
  };
  const draft = (saleQuantity: number, giftQuantity: number) => ({
    originalSalesOrderId: sale.id, warehouseId, returnDate: day, reason: "Integration sales return",
    settlementType: "REDUCE_DEBT", lines: [
      { originalSalesOrderLineId: saleLine.id, quantity: saleQuantity, note: "Sale return" },
      { originalSalesOrderLineId: giftLine.id, quantity: giftQuantity, note: "Gift return" },
    ],
  });

  try {
    ok((await request("/api/v1/sales-returns", "GET", undefined, null)).status === 401, "authentication required");
    ok((await request("/api/v1/sales-returns", "GET", undefined, deniedToken)).status === 403, "RBAC denied");

    let response = await request("/api/v1/sales-returns", "POST", draft(2, 1));
    ok(response.status === 201 && response.body.data.status === "DRAFT", "create return draft");
    const postedReturnId = response.body.data.id as number;
    returnIds.push(postedReturnId);
    const postedReturnVersion = response.body.data.version as number;
    const saleReturnLine = response.body.data.lines.find((line: any) => line.lineType === "SALE");
    const giftReturnLine = response.body.data.lines.find((line: any) => line.lineType === "PROMOTION");
    ok(near(saleReturnLine.lineTotal, 180) && near(saleReturnLine.taxAmount, 18) && near(saleReturnLine.costAmount, 100), "sale snapshot revenue VAT COGS");
    ok(near(giftReturnLine.lineTotal, 0) && near(giftReturnLine.taxAmount, 0) && near(giftReturnLine.costAmount, 20), "promotion return has zero revenue VAT and COGS");
    ok(near(response.body.data.subtotal, 180) && near(response.body.data.taxAmount, 18) && near(response.body.data.totalAmount, 198) && near(response.body.data.costAmount, 120), "return header snapshots");

    response = await request("/api/v1/sales-returns", "POST", draft(1, 5));
    ok(response.status === 201, "create competing draft before post");
    const competingId = response.body.data.id as number;
    returnIds.push(competingId);
    const competingVersion = response.body.data.version as number;

    response = await request(`/api/v1/sales-returns/${postedReturnId}/post`, "POST", { version: postedReturnVersion });
    ok(response.status === 200 && response.body.data.status === "POSTED", "post return");
    const cancelVersion = response.body.data.version as number;
    const balances = await prisma.productwarehouses.findMany({ where: { warehouseId, packagingId: { in: [salePackagingId, giftPackagingId] } } });
    ok(balances.find(row => row.packagingId === salePackagingId)?.stock_quantity === 92 && balances.find(row => row.packagingId === giftPackagingId)?.stock_quantity === 96, "restore SALE and PROMOTION stock");
    const inboundLedger = await prisma.inventory_ledger.findMany({ where: { sourceType: "SALES_RETURN", sourceId: postedReturnId } });
    ok(inboundLedger.length === 2 && inboundLedger.every(row => row.direction === "IN") && near(inboundLedger.reduce((sum, row) => sum + Number(row.totalValue), 0), 120), "inventory receipt ledger snapshots");
    let outstandingRows = await prisma.$queryRawUnsafe<any[]>("SELECT SUM(amount) outstanding FROM receivable_transactions WHERE sourceId=? AND customerId=?", sale.id, customerId);
    ok(near(Number(outstandingRows[0].outstanding), 792), "credit reduces outstanding");
    let projectedSale = await prisma.sales_orders.findUniqueOrThrow({ where: { id: sale.id } });
    ok(projectedSale.paymentStatus === "UNPAID" && Number(projectedSale.paidAmount) === 0, "credit does not become cash payment");

    response = await request(`/api/v1/sales-returns/${competingId}/post`, "POST", { version: competingVersion });
    ok(response.status === 409 && response.body.code === "RETURN_QUANTITY_EXCEEDED", "recheck aggregate quantity cap at post");
    response = await request("/api/v1/sales-returns", "POST", draft(1, 5));
    ok(response.status === 409 && response.body.code === "RETURN_QUANTITY_EXCEEDED", "reject return over remaining quantity at draft");

    projectedSale = await prisma.sales_orders.findUniqueOrThrow({ where: { id: sale.id } });
    response = await request(`/api/v1/sales-documents/${sale.id}/cancel`, "POST", { version: projectedSale.version, reason: "Must reject posted return" });
    ok(response.status === 409 && response.body.code === "POSTED_RETURN_EXISTS", "block original sale cancellation");

    const receiptPayload = (amount: number) => ({ partnerId: customerId, paymentDate: day, method: "BANK", amount, note: "Return integration receipt", allocations: [{ documentId: sale.id, amount }] });
    response = await request("/api/v1/debt/receipts", "POST", receiptPayload(793));
    ok(response.status === 201, "create over-outstanding receipt draft");
    receiptIds.push(BigInt(response.body.data.id));
    let receiptVersion = response.body.data.version as number;
    response = await request(`/api/v1/debt/receipts/${response.body.data.id}/post`, "POST", { version: receiptVersion });
    ok(response.status === 409 && response.body.code === "ALLOCATION_EXCEEDS_DEBT", "payment cannot exceed post-return outstanding");

    response = await request("/api/v1/debt/receipts", "POST", receiptPayload(792));
    ok(response.status === 201, "create exact outstanding receipt");
    const paidReceiptId = BigInt(response.body.data.id);
    receiptIds.push(paidReceiptId);
    receiptVersion = response.body.data.version as number;
    response = await request(`/api/v1/debt/receipts/${paidReceiptId}/post`, "POST", { version: receiptVersion });
    ok(response.status === 200 && response.body.data.status === "POSTED", "post exact outstanding receipt");
    outstandingRows = await prisma.$queryRawUnsafe<any[]>("SELECT SUM(amount) outstanding FROM receivable_transactions WHERE sourceId=? AND customerId=?", sale.id, customerId);
    projectedSale = await prisma.sales_orders.findUniqueOrThrow({ where: { id: sale.id } });
    ok(near(Number(outstandingRows[0].outstanding), 0) && projectedSale.paymentStatus === "PAID" && near(Number(projectedSale.paidAmount), 792), "receipt projection uses ledger outstanding");

    response = await request(`/api/v1/reports/sales-profit?from=${day}&to=${day}&warehouseId=${warehouseId}`);
    const net = response.body.data.rows.find((row: any) => row.id === sale.id);
    ok(response.status === 200 && near(net.netRevenue, 720) && near(net.taxAmount, 72) && near(net.cogs, 480) && near(net.grossProfit, 240), "reporting nets posted return");

    response = await request(`/api/v1/sales-returns/${postedReturnId}/cancel`, "POST", { version: cancelVersion, reason: "Integration reversal" });
    ok(response.status === 200 && response.body.data.status === "CANCELLED", "cancel return");
    const finalBalances = await prisma.productwarehouses.findMany({ where: { warehouseId, packagingId: { in: [salePackagingId, giftPackagingId] } } });
    ok(finalBalances.find(row => row.packagingId === salePackagingId)?.stock_quantity === 90 && finalBalances.find(row => row.packagingId === giftPackagingId)?.stock_quantity === 95, "return cancellation restores stock balances");
    const outboundLedger = await prisma.inventory_ledger.findMany({ where: { sourceType: "SALES_RETURN_CANCEL", sourceId: postedReturnId } });
    ok(outboundLedger.length === 2 && outboundLedger.every(row => row.direction === "OUT" && row.reversalOfId !== null), "inventory reversal links originals");
    const credit = await prisma.receivable_transactions.findFirstOrThrow({ where: { sourceType: "SALES_RETURN", sourceId: sale.id, sourceCode: response.body.data.code } });
    const creditReversal = await prisma.receivable_transactions.findFirstOrThrow({ where: { sourceType: "SALES_RETURN_CANCEL", sourceId: sale.id, sourceCode: response.body.data.code } });
    ok(creditReversal.reversalOfId === credit.id && near(Number(creditReversal.amount), 198), "credit reversal links original");
    outstandingRows = await prisma.$queryRawUnsafe<any[]>("SELECT SUM(amount) outstanding FROM receivable_transactions WHERE sourceId=? AND customerId=?", sale.id, customerId);
    projectedSale = await prisma.sales_orders.findUniqueOrThrow({ where: { id: sale.id } });
    ok(near(Number(outstandingRows[0].outstanding), 198) && projectedSale.paymentStatus === "PARTIAL" && near(Number(projectedSale.paidAmount), 792), "cancel return restores outstanding projection");
    response = await request(`/api/v1/reports/sales-profit?from=${day}&to=${day}&warehouseId=${warehouseId}`);
    const restored = response.body.data.rows.find((row: any) => row.id === sale.id);
    ok(near(restored.netRevenue, 900) && near(restored.taxAmount, 90) && near(restored.cogs, 600) && near(restored.grossProfit, 300), "cancelled return excluded from reporting");

    console.log(`SALES_RETURN_INTEGRATION_OK assertions=${assertions}`);
  } finally {
    server.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try {
    await cleanup();
    const residue = await prisma.sales_returns.count({ where: { code: { startsWith: prefix } } });
    console.log(`SALES_RETURN_FIXTURE_CLEANED residue=${residue}`);
  } finally {
    await prisma.$disconnect();
  }
});