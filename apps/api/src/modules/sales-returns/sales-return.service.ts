import type { SalesReturnCancelInput, SalesReturnDraftInput, SalesReturnUpdateInput } from "@challenge/contracts";
import { HttpError } from "../../common/http-error";
import { mapSalesReturn } from "./sales-return.mapper";
import { Prisma, prisma, salesReturnInclude, salesReturnRepository } from "./sales-return.repository";
import { nextDocumentCode } from "../../common/document-code";

const decimal = (value: number) => new Prisma.Decimal(value.toFixed(4));
const money = (value: number) => new Prisma.Decimal(value.toFixed(2));
const day = (value: string) => new Date(`${value}T12:00:00.000Z`);
const nowIso = () => new Date().toISOString();

async function build(input: SalesReturnDraftInput) {
  const [sale, warehouse] = await Promise.all([
    salesReturnRepository.sale(input.originalSalesOrderId),
    salesReturnRepository.warehouse(input.warehouseId),
  ]);
  if (!sale || sale.status !== "FULFILLED") throw new HttpError(422, "ORIGINAL_SALE_NOT_POSTED", "Chỉ trả hàng từ đơn bán đã ghi sổ");
  if (!warehouse) throw new HttpError(422, "WAREHOUSE_NOT_FOUND", "Kho nhận không tồn tại");
  const ids = new Set(input.lines.map(line => line.originalSalesOrderLineId));
  const originals = sale.sales_order_details.filter(line => ids.has(line.id));
  if (originals.length !== ids.size) throw new HttpError(422, "ORIGINAL_LINE_NOT_FOUND", "Có dòng bán gốc không tồn tại trong đơn");
  const posted = await prisma.sales_return_lines.groupBy({
    by: ["originalSalesOrderLineId"],
    where: { originalSalesOrderLineId: { in: [...ids] }, salesReturn: { status: "POSTED" } },
    _sum: { quantity: true },
  });
  const taxRate = Number(sale.subtotal || 0) > 0 ? Number(sale.taxAmount || 0) / Number(sale.subtotal) : 0;
  const lines = input.lines.map(payload => {
    const original = originals.find(line => line.id === payload.originalSalesOrderLineId)!;
    const returned = Number(posted.find(line => line.originalSalesOrderLineId === original.id)?._sum.quantity || 0);
    const available = Number(original.quantity) - returned;
    if (payload.quantity > available + 0.00005) throw new HttpError(409, "RETURN_QUANTITY_EXCEEDED", `Số lượng trả vượt còn lại của ${original.productpackagings.name}`);
    const unitRevenue = Number(original.quantity) ? Number(original.lineTotal || 0) / Number(original.quantity) : 0;
    const unitCost = Number(original.unitCost || 0);
    const lineTotal = payload.quantity * unitRevenue;
    return {
      originalSalesOrderLineId: original.id,
      packagingId: original.packagingId,
      lineType: original.lineType,
      quantity: payload.quantity,
      unitPrice: Number(original.unitPrice || 0),
      lineTotal,
      taxAmount: lineTotal * taxRate,
      unitCost,
      costAmount: payload.quantity * unitCost,
      note: payload.note || "",
    };
  });
  return {
    sale,
    lines,
    subtotal: lines.reduce((sum, line) => sum + line.lineTotal, 0),
    taxAmount: lines.reduce((sum, line) => sum + line.taxAmount, 0),
    costAmount: lines.reduce((sum, line) => sum + line.costAmount, 0),
  };
}

const lineData = (line: any) => ({
  ...line,
  quantity: decimal(line.quantity),
  unitPrice: decimal(line.unitPrice),
  lineTotal: money(line.lineTotal),
  taxAmount: money(line.taxAmount),
  unitCost: decimal(line.unitCost),
  costAmount: money(line.costAmount),
});

async function lock(tx: any, id: number) {
  const rows = await tx.$queryRawUnsafe("SELECT id,status,version FROM sales_returns WHERE id=? FOR UPDATE", id) as any[];
  if (!rows[0]) throw new HttpError(404, "SALES_RETURN_NOT_FOUND", "Không tìm thấy phiếu trả hàng");
  return rows[0];
}

async function outstanding(tx: any, salesOrderId: number, customerId: number) {
  const rows = await tx.$queryRawUnsafe(
    "SELECT COALESCE(SUM(amount),0) outstanding FROM receivable_transactions WHERE sourceId=? AND customerId=?",
    salesOrderId, customerId,
  ) as any[];
  return Number(rows[0]?.outstanding || 0);
}

async function updatePaymentProjection(tx: any, salesOrderId: number, customerId: number, updatedAt: string | Date) {
  const remaining = await outstanding(tx, salesOrderId, customerId);
  const sale = await tx.sales_orders.findUnique({ where: { id: salesOrderId }, select: { paidAmount: true } });
  const paymentStatus = remaining <= 0.005 ? "PAID" : Number(sale?.paidAmount || 0) > 0.005 ? "PARTIAL" : "UNPAID";
  await tx.sales_orders.update({ where: { id: salesOrderId }, data: { paymentStatus, version: { increment: 1 }, updatedAt } });
  return remaining;
}

export const salesReturnService = {
  async list(query: any) {
    const where: any = {
      sourceModule: "SALES_RETURN_V1",
      ...(query.status ? { status: query.status } : {}),
      ...(query.originalSalesOrderId ? { originalSalesOrderId: query.originalSalesOrderId } : {}),
      ...(query.search ? { OR: [{ code: { contains: query.search } }, { originalSalesOrder: { code: { contains: query.search } } }, { originalSalesOrder: { customers: { name: { contains: query.search } } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      salesReturnRepository.list(where, (query.page - 1) * query.limit, query.limit),
      salesReturnRepository.count(where),
    ]);
    return { data: rows.map(mapSalesReturn), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  },

  async get(id: number) {
    const document = await salesReturnRepository.find(id);
    if (!document) throw new HttpError(404, "SALES_RETURN_NOT_FOUND", "Không tìm thấy phiếu trả hàng");
    return mapSalesReturn(document);
  },

  async create(input: SalesReturnDraftInput, userId: number) {
    const calculation = await build(input);
    const code = await nextDocumentCode("sales_return");
    const now = new Date();
    const row = await prisma.sales_returns.create({
      data: {
        code, originalSalesOrderId: calculation.sale.id, customerId: calculation.sale.customerId,
        warehouseId: input.warehouseId, returnDate: day(input.returnDate), reason: input.reason,
        settlementType: input.settlementType, subtotal: money(calculation.subtotal), taxAmount: money(calculation.taxAmount),
        totalAmount: money(calculation.subtotal + calculation.taxAmount), costAmount: money(calculation.costAmount),
        createdBy: userId, updatedAt: now, lines: { create: calculation.lines.map(lineData) },
      },
      include: salesReturnInclude,
    });
    await prisma.audit_logs.create({ data: { action: "Tạo trả hàng bán v1", details: code, userId, userName: String(userId), createdAt: nowIso() } });
    return mapSalesReturn(row);
  },

  async update(id: number, input: SalesReturnUpdateInput, userId: number) {
    const calculation = await build(input);
    return prisma.$transaction(async tx => {
      const current = await lock(tx, id);
      if (current.status !== "DRAFT") throw new HttpError(409, "RETURN_NOT_EDITABLE", "Chỉ phiếu nháp được sửa");
      if (Number(current.version) !== input.version) throw new HttpError(409, "VERSION_CONFLICT", "Phiếu đã được cập nhật");
      await tx.sales_return_lines.deleteMany({ where: { salesReturnId: id } });
      const row = await tx.sales_returns.update({
        where: { id },
        data: {
          originalSalesOrderId: calculation.sale.id, customerId: calculation.sale.customerId, warehouseId: input.warehouseId,
          returnDate: day(input.returnDate), reason: input.reason, settlementType: input.settlementType,
          subtotal: money(calculation.subtotal), taxAmount: money(calculation.taxAmount),
          totalAmount: money(calculation.subtotal + calculation.taxAmount), costAmount: money(calculation.costAmount),
          version: { increment: 1 }, updatedAt: new Date(), lines: { create: calculation.lines.map(lineData) },
        },
        include: salesReturnInclude,
      });
      await tx.audit_logs.create({ data: { action: "Cập nhật trả hàng bán v1", details: row.code, userId, userName: String(userId), createdAt: nowIso() } });
      return mapSalesReturn(row);
    });
  },

  async post(id: number, version: number, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lock(tx, id);
      if (current.status !== "DRAFT") throw new HttpError(409, "RETURN_NOT_DRAFT", "Chỉ phiếu nháp được ghi sổ");
      if (Number(current.version) !== version) throw new HttpError(409, "VERSION_CONFLICT", "Phiếu đã được cập nhật");
      const document = await tx.sales_returns.findUnique({ where: { id }, include: salesReturnInclude });
      if (!document) throw new HttpError(404, "SALES_RETURN_NOT_FOUND", "Không tìm thấy phiếu trả hàng");
      await tx.$queryRawUnsafe("SELECT id FROM sales_orders WHERE id=? FOR UPDATE", document.originalSalesOrderId);
      const remainingBefore = await outstanding(tx, document.originalSalesOrderId, document.customerId);
      if (Number(document.totalAmount) > remainingBefore + 0.005) throw new HttpError(409, "RETURN_CREDIT_EXCEEDS_DEBT", "Giá trị trả vượt công nợ; V1 chưa hỗ trợ hoàn tiền");
      for (const line of document.lines) {
        const quantities = await tx.$queryRawUnsafe(`SELECT COALESCE(SUM(rl.quantity),0) returned
          FROM sales_return_lines rl JOIN sales_returns r ON r.id=rl.salesReturnId
          WHERE rl.originalSalesOrderLineId=? AND r.status='POSTED' FOR UPDATE`, line.originalSalesOrderLineId) as any[];
        if (Number(quantities[0]?.returned || 0) + Number(line.quantity) > Number(line.originalSalesOrderLine.quantity) + 0.00005) {
          throw new HttpError(409, "RETURN_QUANTITY_EXCEEDED", "Số lượng trả vượt số lượng đã bán");
        }
      }
      const now = nowIso(), occurredAt = new Date();
      const inventory = await tx.inventorytransactions.create({ data: {
        code: `PN-${document.code}`, type: "IMPORT", transaction_date: now.slice(0, 10), entry_date: now.slice(0, 10),
        warehouseId: document.warehouseId, note: `Nhập trả hàng ${document.code}`, reason: document.reason,
        customerId: document.customerId, createdBy: userId, createdAt: now, updatedAt: now,
        documentStatus: "POSTED", postedAt: occurredAt, postedBy: userId, sourceModule: "SALES_RETURN_V1",
      } });
      for (const line of document.lines) {
        await tx.inventorytransactiondetails.create({ data: {
          transactionId: inventory.id, packagingId: line.packagingId, quantity: Number(line.quantity),
          unitCost: line.unitCost, totalValue: line.costAmount, note: document.code, createdAt: now, updatedAt: now,
        } });
        await tx.productwarehouses.upsert({
          where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId: document.warehouseId } },
          create: { packagingId: line.packagingId, warehouseId: document.warehouseId, stock_quantity: Number(line.quantity), updatedAt: now },
          update: { stock_quantity: { increment: Number(line.quantity) }, updatedAt: now },
        });
        await tx.inventory_ledger.create({ data: {
          sourceType: "SALES_RETURN", sourceId: id, sourceLineId: line.id, documentCode: document.code, direction: "IN",
          packagingId: line.packagingId, warehouseId: document.warehouseId, quantity: line.quantity,
          unitCost: line.unitCost, totalValue: line.costAmount, occurredAt, createdBy: userId,
        } });
      }
      const credit = await tx.receivable_transactions.create({ data: {
        customerId: document.customerId, sourceType: "SALES_RETURN", sourceId: document.originalSalesOrderId,
        sourceCode: document.code, entryType: "CREDIT", amount: money(-Number(document.totalAmount)), occurredAt, createdBy: userId,
      } });
      await updatePaymentProjection(tx, document.originalSalesOrderId, document.customerId, now);
      await tx.sales_return_document_links.createMany({ data: [
        { salesReturnId: id, linkType: "INVENTORY_RECEIPT", linkedId: BigInt(inventory.id), linkedCode: inventory.code },
        { salesReturnId: id, linkType: "RECEIVABLE_CREDIT", linkedId: credit.id, linkedCode: document.code },
      ] });
      const row = await tx.sales_returns.update({ where: { id }, data: { status: "POSTED", postedAt: occurredAt, postedBy: userId, version: { increment: 1 }, updatedAt: occurredAt }, include: salesReturnInclude });
      await tx.audit_logs.create({ data: { action: "Ghi sổ trả hàng bán v1", details: document.code, userId, userName: String(userId), createdAt: now } });
      return mapSalesReturn(row);
    }, { timeout: 30_000 });
  },

  async cancel(id: number, input: SalesReturnCancelInput, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lock(tx, id);
      if (current.status !== "POSTED") throw new HttpError(409, "RETURN_NOT_POSTED", "Chỉ phiếu đã ghi sổ được hủy");
      if (Number(current.version) !== input.version) throw new HttpError(409, "VERSION_CONFLICT", "Phiếu đã được cập nhật");
      const document = await tx.sales_returns.findUnique({ where: { id }, include: salesReturnInclude });
      if (!document) throw new HttpError(404, "SALES_RETURN_NOT_FOUND", "Không tìm thấy phiếu trả hàng");
      await tx.$queryRawUnsafe("SELECT id FROM sales_orders WHERE id=? FOR UPDATE", document.originalSalesOrderId);
      const now = nowIso(), occurredAt = new Date();
      for (const line of document.lines) {
        const balances = await tx.$queryRawUnsafe(
          "SELECT stock_quantity FROM productwarehouses WHERE packagingId=? AND warehouseId=? FOR UPDATE",
          line.packagingId, document.warehouseId,
        ) as any[];
        if (Number(balances[0]?.stock_quantity || 0) < Number(line.quantity)) throw new HttpError(409, "RETURN_REVERSAL_STOCK_SHORTAGE", "Không đủ tồn để đảo phiếu trả");
        const original = await tx.inventory_ledger.findFirst({ where: { sourceType: "SALES_RETURN", sourceId: id, sourceLineId: line.id } });
        if (!original) throw new HttpError(409, "RETURN_INVENTORY_LEDGER_NOT_FOUND", "Không tìm thấy ledger nhập trả gốc");
        await tx.productwarehouses.update({
          where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId: document.warehouseId } },
          data: { stock_quantity: { decrement: Number(line.quantity) }, updatedAt: now },
        });
        await tx.inventory_ledger.create({ data: {
          sourceType: "SALES_RETURN_CANCEL", sourceId: id, sourceLineId: line.id, documentCode: document.code, direction: "OUT",
          packagingId: line.packagingId, warehouseId: document.warehouseId, quantity: line.quantity,
          unitCost: line.unitCost, totalValue: line.costAmount, reversalOfId: original.id, occurredAt, createdBy: userId,
        } });
      }
      const credit = await tx.receivable_transactions.findFirst({ where: {
        sourceType: "SALES_RETURN", sourceId: document.originalSalesOrderId, sourceCode: document.code, entryType: "CREDIT",
      } });
      if (!credit) throw new HttpError(409, "RETURN_CREDIT_NOT_FOUND", "Không tìm thấy credit gốc");
      const reversal = await tx.receivable_transactions.create({ data: {
        customerId: document.customerId, sourceType: "SALES_RETURN_CANCEL", sourceId: document.originalSalesOrderId,
        sourceCode: document.code, entryType: "CREDIT_REVERSAL", amount: money(Number(document.totalAmount)),
        reversalOfId: credit.id, occurredAt, createdBy: userId,
      } });
      await updatePaymentProjection(tx, document.originalSalesOrderId, document.customerId, now);
      await tx.sales_return_document_links.createMany({ data: [
        { salesReturnId: id, linkType: "RECEIVABLE_REVERSAL", linkedId: reversal.id, linkedCode: document.code },
      ] });
      const row = await tx.sales_returns.update({ where: { id }, data: {
        status: "CANCELLED", cancelledAt: occurredAt, cancelledBy: userId, cancelReason: input.reason,
        version: { increment: 1 }, updatedAt: occurredAt,
      }, include: salesReturnInclude });
      await tx.audit_logs.create({ data: { action: "Hủy trả hàng bán v1", details: `${document.code}: ${input.reason}`, userId, userName: String(userId), createdAt: now } });
      return mapSalesReturn(row);
    }, { timeout: 30_000 });
  },
};