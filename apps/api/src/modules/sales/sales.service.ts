import { Prisma } from "@challenge/database";
import type { SalesCancelInput, SalesDraftInput, SalesPaymentInput, SalesRejectInput, SalesUpdateInput } from "@challenge/contracts";
import { HttpError } from "../../common/http-error";
import { mapSalesDocument } from "./sales.mapper";
import { prisma, salesInclude, salesRepository } from "./sales.repository";

const decimal = (value: number) => new Prisma.Decimal(value.toFixed(4));
const money = (value: number) => new Prisma.Decimal(value.toFixed(2));
const dateAtNoon = (date: string) => new Date(`${date}T12:00:00.000Z`);
const nowIso = () => new Date().toISOString();

function calculate(input: SalesDraftInput) {
  const details = input.details.map(line => {
    const gross = line.quantity * line.unitPrice;
    const lineTotal = gross * (1 - line.discountRate / 100);
    return { ...line, gross, lineTotal };
  });
  const gross = details.reduce((sum, line) => sum + line.gross, 0);
  const subtotal = details.reduce((sum, line) => sum + line.lineTotal, 0);
  const discountAmount = gross - subtotal;
  const taxAmount = subtotal * input.taxRate / 100;
  return { details, subtotal, discountAmount, taxAmount, totalAmount: subtotal + taxAmount };
}

async function validateMasterData(input: SalesDraftInput) {
  const [customer, warehouse, packagingIds] = await Promise.all([
    salesRepository.customerExists(input.customerId),
    salesRepository.warehouseExists(input.warehouseId),
    salesRepository.packagingIds(input.details.map(line => line.packagingId)),
  ]);
  if (!customer) throw new HttpError(422, "CUSTOMER_NOT_FOUND", "Khách hàng không tồn tại");
  if (!warehouse) throw new HttpError(422, "WAREHOUSE_NOT_FOUND", "Kho xuất không tồn tại");
  input.details.forEach((line, index) => {
    if (!packagingIds.has(line.packagingId)) throw new HttpError(422, "ITEM_NOT_FOUND", `Hàng hóa dòng ${index + 1} không tồn tại`);
  });
  return customer;
}

const lineData = (line: ReturnType<typeof calculate>["details"][number]) => ({
  packagingId: line.packagingId,
  quantity: line.quantity,
  unitPrice: line.unitPrice,
  discountRate: line.discountRate,
  lineTotal: line.lineTotal,
  note: line.note || "",
});

async function lockOrder(tx: any, id: number) {
  const rows = await tx.$queryRawUnsafe("SELECT id,status,version FROM sales_orders WHERE id=? FOR UPDATE", id) as any[];
  if (!rows[0]) throw new HttpError(404, "SALES_NOT_FOUND", "Không tìm thấy chứng từ bán hàng");
  return rows[0];
}

function assertVersion(current: any, version: number) {
  if (Number(current.version) !== version) throw new HttpError(409, "VERSION_CONFLICT", "Chứng từ đã được người khác cập nhật");
}

async function averageCost(tx: any, packagingId: number, warehouseId: number) {
  const rows = await tx.$queryRawUnsafe(
    `SELECT COALESCE(SUM(CASE WHEN direction='IN' THEN quantity ELSE -quantity END),0) quantity,
            COALESCE(SUM(totalValue),0) totalValue
     FROM inventory_ledger WHERE packagingId=? AND warehouseId=?`,
    packagingId, warehouseId,
  ) as Array<{ quantity: unknown; totalValue: unknown }>;
  const ledgerQuantity = Number(rows[0]?.quantity || 0);
  const ledgerValue = Number(rows[0]?.totalValue || 0);
  if (ledgerQuantity > 0 && ledgerValue > 0) return ledgerValue / ledgerQuantity;
  const latestPurchase = await tx.purchase_document_details.findFirst({
    where: { packagingId, purchase_documents: { documentStatus: "POSTED" } },
    orderBy: { id: "desc" }, select: { unitPrice: true },
  });
  return Number(latestPurchase?.unitPrice || 0);
}

export const salesService = {
  async list(query: { page: number; limit: number; search?: string; status?: string }) {
    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status === "POSTED" ? "FULFILLED" : query.status;
    if (query.search) where.OR = [{ code: { contains: query.search } }, { customers: { name: { contains: query.search } } }];
    const [rows, total] = await Promise.all([
      salesRepository.list(where, (query.page - 1) * query.limit, query.limit), salesRepository.count(where),
    ]);
    return { data: rows.map(mapSalesDocument), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  },

  async get(id: number) {
    const row = await salesRepository.findById(id);
    if (!row || row.deletedAt) throw new HttpError(404, "SALES_NOT_FOUND", "Không tìm thấy chứng từ bán hàng");
    return mapSalesDocument(row);
  },

  async createDraft(input: SalesDraftInput, userId: number) {
    await validateMasterData(input);
    const totals = calculate(input);
    const code = `BH-${input.orderDate.replaceAll("-", "")}-${Date.now().toString().slice(-6)}`;
    const now = nowIso();
    const row = await prisma.sales_orders.create({
      data: {
        code, orderDate: input.orderDate, deliveryDate: input.deliveryDate || null, dueDate: input.dueDate || null,
        customerId: input.customerId, warehouseId: input.warehouseId, status: "DRAFT", note: input.note,
        subtotal: totals.subtotal, discountAmount: totals.discountAmount, taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount, paidAmount: 0, paymentStatus: "UNPAID", paymentIntent: input.paymentIntent,
        paymentMethod: input.paymentMethod, createdBy: userId, createdAt: now, updatedAt: now,
        sales_order_details: { create: totals.details.map(lineData) },
      }, include: salesInclude,
    });
    await prisma.audit_logs.create({ data: { action: "Tạo nháp bán hàng v1", details: code, userId, userName: String(userId), createdAt: now } });
    return mapSalesDocument(row);
  },

  async updateDraft(id: number, input: SalesUpdateInput, userId: number) {
    await validateMasterData(input);
    const totals = calculate(input);
    return prisma.$transaction(async tx => {
      const current = await lockOrder(tx, id);
      if (!["DRAFT", "REJECTED"].includes(current.status)) throw new HttpError(409, "SALES_NOT_EDITABLE", "Chỉ được sửa đơn nháp hoặc bị từ chối");
      assertVersion(current, input.version);
      await tx.sales_order_details.deleteMany({ where: { orderId: id } });
      const updated = await tx.sales_orders.update({
        where: { id }, data: {
          orderDate: input.orderDate, deliveryDate: input.deliveryDate || null, dueDate: input.dueDate || null,
          customerId: input.customerId, warehouseId: input.warehouseId, note: input.note,
          subtotal: totals.subtotal, discountAmount: totals.discountAmount, taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount, paymentIntent: input.paymentIntent, paymentMethod: input.paymentMethod,
          rejectionReason: null, version: { increment: 1 }, updatedAt: nowIso(),
          sales_order_details: { create: totals.details.map(lineData) },
        }, include: salesInclude,
      });
      await tx.audit_logs.create({ data: { action: "Cập nhật nháp bán hàng v1", details: updated.code, userId, userName: String(userId), createdAt: nowIso() } });
      return mapSalesDocument(updated);
    });
  },

  async submit(id: number, version: number, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockOrder(tx, id);
      if (!["DRAFT", "REJECTED"].includes(current.status)) throw new HttpError(409, "SALES_NOT_SUBMITTABLE", "Đơn không thể gửi duyệt ở trạng thái hiện tại");
      assertVersion(current, version);
      const updated = await tx.sales_orders.update({ where: { id }, data: { status: "PENDING", rejectionReason: null, version: { increment: 1 }, updatedAt: nowIso() }, include: salesInclude });
      await tx.audit_logs.create({ data: { action: "Gửi duyệt bán hàng v1", details: updated.code, userId, userName: String(userId), createdAt: nowIso() } });
      return mapSalesDocument(updated);
    });
  },

  async approve(id: number, version: number, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockOrder(tx, id);
      if (current.status !== "PENDING") throw new HttpError(409, "SALES_NOT_PENDING", "Chỉ được duyệt đơn đang chờ duyệt");
      assertVersion(current, version);
      const now = nowIso();
      const updated = await tx.sales_orders.update({ where: { id }, data: { status: "APPROVED", approvedBy: userId, approvedAt: now, version: { increment: 1 }, updatedAt: now }, include: salesInclude });
      await tx.audit_logs.create({ data: { action: "Duyệt bán hàng v1", details: updated.code, userId, userName: String(userId), createdAt: now } });
      return mapSalesDocument(updated);
    });
  },

  async reject(id: number, input: SalesRejectInput, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockOrder(tx, id);
      if (current.status !== "PENDING") throw new HttpError(409, "SALES_NOT_PENDING", "Chỉ được từ chối đơn đang chờ duyệt");
      assertVersion(current, input.version);
      const updated = await tx.sales_orders.update({ where: { id }, data: { status: "REJECTED", rejectionReason: input.reason, version: { increment: 1 }, updatedAt: nowIso() }, include: salesInclude });
      await tx.audit_logs.create({ data: { action: "Từ chối bán hàng v1", details: `${updated.code}: ${input.reason}`, userId, userName: String(userId), createdAt: nowIso() } });
      return mapSalesDocument(updated);
    });
  },

  async post(id: number, version: number, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockOrder(tx, id);
      if (current.status !== "APPROVED") throw new HttpError(409, "SALES_NOT_APPROVED", "Chỉ được ghi sổ đơn đã duyệt");
      assertVersion(current, version);
      const document = await tx.sales_orders.findUnique({ where: { id }, include: salesInclude });
      if (!document) throw new HttpError(404, "SALES_NOT_FOUND", "Không tìm thấy chứng từ bán hàng");
      const now = nowIso();
      const postedAt = new Date();

      for (const line of document.sales_order_details) {
        const balances = await tx.$queryRawUnsafe<any[]>(
          "SELECT stock_quantity FROM productwarehouses WHERE packagingId=? AND warehouseId=? FOR UPDATE",
          line.packagingId, document.warehouseId,
        );
        if (Number(balances[0]?.stock_quantity || 0) < Number(line.quantity)) {
          throw new HttpError(409, "INSUFFICIENT_STOCK", `Không đủ tồn kho cho ${line.productpackagings?.name || line.packagingId}`);
        }
      }

      const transactionCode = `PX-${document.code}`;
      const inventoryTransaction = await tx.inventorytransactions.create({
        data: {
          code: transactionCode, type: "EXPORT", transaction_date: document.orderDate, exit_date: document.orderDate,
          warehouseId: document.warehouseId, note: `Xuất bán theo ${document.code}`, reason: "Bán hàng",
          recipient: document.customers?.name || "Khách hàng", customerId: document.customerId,
          createdBy: userId, createdAt: now, updatedAt: now,
        },
      });

      for (const line of document.sales_order_details) {
        const quantity = Number(line.quantity);
        const unitCost = await averageCost(tx, line.packagingId, document.warehouseId);
        const costAmount = quantity * unitCost;
        await tx.inventorytransactiondetails.create({ data: { transactionId: inventoryTransaction.id, packagingId: line.packagingId, quantity, note: document.code, createdAt: now, updatedAt: now } });
        await tx.productwarehouses.update({
          where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId: document.warehouseId } },
          data: { stock_quantity: { decrement: quantity }, updatedAt: now },
        });
        await tx.inventory_ledger.create({ data: {
          sourceType: "SALE", sourceId: id, sourceLineId: line.id, documentCode: document.code, direction: "OUT",
          packagingId: line.packagingId, warehouseId: document.warehouseId, quantity: decimal(quantity),
          unitCost: decimal(unitCost), totalValue: money(-costAmount), occurredAt: postedAt, createdBy: userId,
        } });
        await tx.sales_order_details.update({ where: { id: line.id }, data: { unitCost: decimal(unitCost), costAmount: money(costAmount) } });
      }

      const charge = await tx.receivable_transactions.create({ data: {
        customerId: document.customerId, sourceType: "SALE", sourceId: id, sourceCode: document.code,
        entryType: "CHARGE", amount: money(Number(document.totalAmount || 0)),
        dueDate: document.dueDate ? dateAtNoon(document.dueDate) : dateAtNoon(document.orderDate), occurredAt: postedAt, createdBy: userId,
      } });
      await tx.sales_document_links_v1.create({ data: { salesOrderId: id, linkType: "INVENTORY_ISSUE", linkedId: BigInt(inventoryTransaction.id), linkedCode: transactionCode } });
      await tx.sales_document_links_v1.create({ data: { salesOrderId: id, linkType: "RECEIVABLE_CHARGE", linkedId: charge.id, linkedCode: document.code } });

      let paidAmount = 0;
      let paymentStatus = "UNPAID";
      if (document.paymentIntent === "PAID") {
        paidAmount = Number(document.totalAmount || 0);
        paymentStatus = "PAID";
        await this.createPaymentInTransaction(tx, document, paidAmount, document.orderDate, document.paymentMethod || "CASH", `Thu ngay ${document.code}`, userId);
      }
      const updated = await tx.sales_orders.update({ where: { id }, data: {
        status: "FULFILLED", fulfilledAt: now, postedAt, postedBy: userId, inventoryTransactionId: inventoryTransaction.id,
        dueDate: document.dueDate || document.orderDate, paidAmount, paymentStatus, version: { increment: 1 }, updatedAt: now,
      }, include: salesInclude });
      await tx.audit_logs.create({ data: { action: "Ghi sổ bán hàng v1", details: document.code, userId, userName: String(userId), createdAt: now } });
      return mapSalesDocument(updated);
    }, { timeout: 30_000 });
  },

  async createPaymentInTransaction(tx: any, document: any, amount: number, paymentDate: string, method: string, note: string, userId: number) {
    const code = `PT-${document.code}-${Date.now().toString().slice(-6)}`;
    const receipt = await tx.payment_receipts.create({ data: {
      code, customerId: document.customerId, receiptDate: dateAtNoon(paymentDate), method, amount: money(amount),
      direction: "RECEIPT", note, status: "POSTED", createdBy: userId,
    } });
    await tx.payment_receipt_allocations.create({ data: { paymentReceiptId: receipt.id, salesOrderId: document.id, amount: money(amount) } });
    const debtEntry = await tx.receivable_transactions.create({ data: {
      customerId: document.customerId, sourceType: "SALE_PAYMENT", sourceId: document.id, sourceCode: document.code,
      entryType: "PAYMENT", amount: money(-amount), occurredAt: new Date(), createdBy: userId,
    } });
    await tx.customer_payments.create({ data: {
      customerId: document.customerId, salesOrderId: document.id, paymentDate, amount, method, note,
      createdBy: userId, createdAt: nowIso(),
    } });
    await tx.sales_document_links_v1.create({ data: { salesOrderId: document.id, linkType: "PAYMENT_RECEIPT", linkedId: receipt.id, linkedCode: code } });
    await tx.sales_document_links_v1.create({ data: { salesOrderId: document.id, linkType: "RECEIVABLE_PAYMENT", linkedId: debtEntry.id, linkedCode: document.code } });
    return receipt;
  },

  async receivePayment(id: number, input: SalesPaymentInput, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockOrder(tx, id);
      if (current.status !== "FULFILLED") throw new HttpError(409, "SALES_NOT_POSTED", "Chỉ được thu tiền chứng từ đã ghi sổ");
      assertVersion(current, input.version);
      const document = await tx.sales_orders.findUnique({ where: { id }, include: salesInclude });
      if (!document) throw new HttpError(404, "SALES_NOT_FOUND", "Không tìm thấy chứng từ bán hàng");
      const remaining = Number(document.totalAmount || 0) - Number(document.paidAmount || 0);
      if (input.amount > remaining + 0.001) throw new HttpError(409, "PAYMENT_EXCEEDS_DEBT", "Số tiền thu vượt quá công nợ còn lại");
      await this.createPaymentInTransaction(tx, document, input.amount, input.paymentDate, input.method, input.note || `Thu tiền ${document.code}`, userId);
      const paidAmount = Number(document.paidAmount || 0) + input.amount;
      const paymentStatus = paidAmount >= Number(document.totalAmount || 0) - 0.001 ? "PAID" : "PARTIAL";
      const updated = await tx.sales_orders.update({ where: { id }, data: { paidAmount, paymentStatus, version: { increment: 1 }, updatedAt: nowIso() }, include: salesInclude });
      await tx.audit_logs.create({ data: { action: "Thu tiền bán hàng v1", details: `${document.code}: ${input.amount}`, userId, userName: String(userId), createdAt: nowIso() } });
      return mapSalesDocument(updated);
    });
  },

  async cancel(id: number, input: SalesCancelInput, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockOrder(tx, id);
      if (current.status !== "FULFILLED") throw new HttpError(409, "SALES_NOT_POSTED", "Chỉ được hủy chứng từ đã ghi sổ");
      assertVersion(current, input.version);
      const document = await tx.sales_orders.findUnique({ where: { id }, include: salesInclude });
      if (!document) throw new HttpError(404, "SALES_NOT_FOUND", "Không tìm thấy chứng từ bán hàng");
      const debtPayments = await tx.$queryRawUnsafe<any[]>(`SELECT COUNT(*) count
        FROM payment_receipt_allocations a JOIN payment_receipts r ON r.id=a.paymentReceiptId
        WHERE a.salesOrderId=? AND r.sourceModule='DEBT_V1' AND r.status='POSTED'`, id);
      if (Number(debtPayments[0]?.count || 0) > 0) throw new HttpError(409, "DEBT_PAYMENT_EXISTS", "Hãy hủy phiếu thu công nợ V1 trước khi hủy chứng từ bán hàng");
      const links = document.sales_document_links_v1;
      if (!links.some(link => link.linkType === "RECEIVABLE_CHARGE")) {
        throw new HttpError(409, "LEGACY_SALE_NOT_REVERSIBLE", "Chứng từ legacy chưa có ledger v1; không thể hủy tự động");
      }
      const now = nowIso();
      const cancelledAt = new Date();
      const reversalCode = `H-PX-${document.code}`;
      const reversalTransaction = await tx.inventorytransactions.create({ data: {
        code: reversalCode, type: "IMPORT", transaction_date: now.slice(0, 10), entry_date: now.slice(0, 10),
        warehouseId: document.warehouseId, note: `Hoàn nhập do hủy ${document.code}`, reason: "Hủy bán hàng",
        recipient: document.customers?.name || "Khách hàng", customerId: document.customerId,
        createdBy: userId, createdAt: now, updatedAt: now,
      } });
      for (const line of document.sales_order_details) {
        const original = await tx.inventory_ledger.findFirst({ where: { sourceType: "SALE", sourceId: id, sourceLineId: line.id, direction: "OUT" } });
        await tx.inventorytransactiondetails.create({ data: { transactionId: reversalTransaction.id, packagingId: line.packagingId, quantity: Number(line.quantity), note: input.reason, createdAt: now, updatedAt: now } });
        await tx.productwarehouses.upsert({
          where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId: document.warehouseId } },
          create: { packagingId: line.packagingId, warehouseId: document.warehouseId, stock_quantity: Number(line.quantity), updatedAt: now },
          update: { stock_quantity: { increment: Number(line.quantity) }, updatedAt: now },
        });
        await tx.inventory_ledger.create({ data: {
          sourceType: "SALE_CANCEL", sourceId: id, sourceLineId: line.id, documentCode: document.code, direction: "IN",
          packagingId: line.packagingId, warehouseId: document.warehouseId, quantity: decimal(Number(line.quantity)),
          unitCost: original?.unitCost || line.unitCost, totalValue: money(Math.abs(Number(original?.totalValue || line.costAmount || 0))),
          reversalOfId: original?.id, occurredAt: cancelledAt, createdBy: userId,
        } });
      }
      const charge = await tx.receivable_transactions.findFirst({ where: { sourceType: "SALE", sourceId: id, entryType: "CHARGE" } });
      const reversal = await tx.receivable_transactions.create({ data: {
        customerId: document.customerId, sourceType: "SALE_CANCEL", sourceId: id, sourceCode: document.code,
        entryType: "REVERSAL", amount: money(-Number(document.totalAmount || 0)), occurredAt: cancelledAt,
        reversalOfId: charge?.id, createdBy: userId,
      } });
      await tx.sales_document_links_v1.create({ data: { salesOrderId: id, linkType: "INVENTORY_REVERSAL", linkedId: BigInt(reversalTransaction.id), linkedCode: reversalCode } });
      await tx.sales_document_links_v1.create({ data: { salesOrderId: id, linkType: "RECEIVABLE_REVERSAL", linkedId: reversal.id, linkedCode: document.code } });

      if (Number(document.paidAmount || 0) > 0) {
        await tx.payment_receipts.updateMany({
          where: { id: { in: links.filter(link => link.linkType === "PAYMENT_RECEIPT").map(link => link.linkedId) } }, data: { status: "CANCELLED" },
        });
        const reversalReceiptCode = `H-PT-${document.code}`;
        const reversalReceipt = await tx.payment_receipts.create({ data: {
          code: reversalReceiptCode, customerId: document.customerId, receiptDate: dateAtNoon(now.slice(0, 10)),
          method: document.paymentMethod || "BANK", amount: money(Number(document.paidAmount)), direction: "REVERSAL",
          note: `Hoàn nguyên thanh toán ${document.code}`, status: "POSTED", createdBy: userId,
        } });
        await tx.payment_receipt_allocations.create({ data: {
          paymentReceiptId: reversalReceipt.id, salesOrderId: id, amount: money(-Number(document.paidAmount)),
        } });
        await tx.sales_document_links_v1.create({ data: {
          salesOrderId: id, linkType: "PAYMENT_REVERSAL", linkedId: reversalReceipt.id, linkedCode: reversalReceiptCode,
        } });
        const paymentEntries = await tx.receivable_transactions.findMany({ where: { sourceType: "SALE_PAYMENT", sourceId: id, entryType: "PAYMENT" } });
        for (const entry of paymentEntries) await tx.receivable_transactions.create({ data: {
          customerId: document.customerId, sourceType: "SALE_PAYMENT_CANCEL", sourceId: id, sourceCode: document.code,
          entryType: "PAYMENT_REVERSAL", amount: money(Math.abs(Number(entry.amount))), occurredAt: cancelledAt,
          reversalOfId: entry.id, createdBy: userId,
        } });
        await tx.customer_payments.create({ data: {
          customerId: document.customerId, salesOrderId: id, paymentDate: now.slice(0, 10), amount: -Number(document.paidAmount),
          method: document.paymentMethod || "BANK", note: `Hoàn nguyên thanh toán ${document.code}`, createdBy: userId, createdAt: now,
        } });
      }
      const updated = await tx.sales_orders.update({ where: { id }, data: {
        status: "CANCELLED", cancelledAt, cancelledBy: userId, cancelReason: input.reason,
        paidAmount: 0, paymentStatus: "UNPAID", version: { increment: 1 }, updatedAt: now,
      }, include: salesInclude });
      await tx.audit_logs.create({ data: { action: "Hủy bán hàng v1", details: `${document.code}: ${input.reason}`, userId, userName: String(userId), createdAt: now } });
      return mapSalesDocument(updated);
    }, { timeout: 30_000 });
  },
};