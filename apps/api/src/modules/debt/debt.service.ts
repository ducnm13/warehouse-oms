import type { DebtCancelInput, DebtPaymentDraftInput, DebtPaymentUpdateInput } from "@challenge/contracts";
import { Prisma } from "@challenge/database";
import { HttpError } from "../../common/http-error";
import { mapPayment } from "./debt.mapper";
import { debtRepository, prisma } from "./debt.repository";

type Kind = "RECEIPT" | "VOUCHER";
const money = (value: number) => new Prisma.Decimal(value.toFixed(2));
const nowIso = () => new Date().toISOString();
const dateAtNoon = (value: string) => new Date(`${value}T12:00:00.000Z`);
const code = (kind: Kind, date: string) => `${kind === "RECEIPT" ? "PTV1" : "PCV1"}-${date.replaceAll("-", "")}-${Date.now().toString().slice(-6)}`;
const table = (kind: Kind) => kind === "RECEIPT" ? "payment_receipts" : "payment_vouchers";

async function lockPayment(tx: any, kind: Kind, id: bigint) {
  const rows = await tx.$queryRawUnsafe(`SELECT id,status,version,sourceModule FROM ${table(kind)} WHERE id=? FOR UPDATE`, id) as any[];
  if (!rows[0] || rows[0].sourceModule !== "DEBT_V1") throw new HttpError(404, "PAYMENT_NOT_FOUND", "Không tìm thấy phiếu thu/chi V1");
  return rows[0];
}
const assertVersion = (row: any, version: number) => { if (Number(row.version) !== version) throw new HttpError(409, "VERSION_CONFLICT", "Dữ liệu đã được người khác cập nhật"); };
const paymentStatus = (paid: number, total: number) => paid <= 0.005 ? "UNPAID" : paid >= total - 0.005 ? "PAID" : "PARTIAL";

async function validatePartner(kind: Kind, partnerId: number) {
  const partner = kind === "RECEIPT" ? await debtRepository.customer(partnerId) : await debtRepository.supplier(partnerId);
  if (!partner) throw new HttpError(422, "PARTNER_NOT_FOUND", "Khách hàng/nhà cung cấp không tồn tại");
}

function assertAllocationTotal(input: DebtPaymentDraftInput) {
  const allocated = input.allocations.reduce((sum, row) => sum + row.amount, 0);
  if (Math.abs(allocated - input.amount) > 0.005) throw new HttpError(422, "ALLOCATION_TOTAL_MISMATCH", "Tổng phân bổ phải bằng số tiền phiếu");
}

async function hydrate(kind: Kind, row: any) {
  if (!row) return null;
  if (kind === "RECEIPT") {
    const [partner, allocations] = await Promise.all([
      prisma.customers.findUnique({ where: { id: row.customerId } }),
      prisma.$queryRawUnsafe<any[]>(`SELECT a.id,a.salesOrderId documentId,a.amount,s.code documentCode,s.totalAmount,s.paidAmount
        FROM payment_receipt_allocations a JOIN sales_orders s ON s.id=a.salesOrderId WHERE a.paymentReceiptId=? ORDER BY a.id`, row.id),
    ]);
    return mapPayment({ ...row, partnerCode: partner?.code, partnerName: partner?.name, paymentDate: row.receiptDate, allocations }, kind);
  }
  const [partner, allocations] = await Promise.all([
    prisma.suppliers.findUnique({ where: { id: row.supplierId } }),
    prisma.$queryRawUnsafe<any[]>(`SELECT a.id,a.purchaseDocumentId documentId,a.amount,p.code documentCode,p.totalAmount,p.paidAmount
      FROM payment_voucher_allocations a JOIN purchase_documents p ON p.id=a.purchaseDocumentId WHERE a.paymentVoucherId=? ORDER BY a.id`, row.id),
  ]);
  return mapPayment({ ...row, partnerCode: partner?.code, partnerName: partner?.name, paymentDate: row.voucherDate, allocations }, kind);
}

async function findPayment(kind: Kind, id: bigint) {
  return kind === "RECEIPT" ? prisma.payment_receipts.findUnique({ where: { id } }) : prisma.payment_vouchers.findUnique({ where: { id } });
}

export const debtService = {
  async aging(kind: Kind, query: any) {
    const asOf = query.asOf ? dateAtNoon(query.asOf) : new Date();
    const search = query.search ? `%${query.search}%` : null;
    const rows = kind === "RECEIPT"
      ? await prisma.$queryRawUnsafe<any[]>(`SELECT s.id documentId,s.code documentCode,s.customerId partnerId,c.code partnerCode,c.name partnerName,
          s.orderDate documentDate,s.dueDate,COALESCE(s.totalAmount,0) totalAmount,
          COALESCE((SELECT SUM(r.amount) FROM receivable_transactions r WHERE r.sourceId=s.id AND r.customerId=s.customerId),0) outstanding
        FROM sales_orders s JOIN customers c ON c.id=s.customerId
        WHERE s.status='FULFILLED' AND (? IS NULL OR s.customerId=?) AND (? IS NULL OR s.code LIKE ? OR c.code LIKE ? OR c.name LIKE ?)
        HAVING outstanding > 0.005 ORDER BY COALESCE(s.dueDate,s.orderDate),s.id`, query.partnerId || null, query.partnerId || null, search, search, search, search)
      : await prisma.$queryRawUnsafe<any[]>(`SELECT p.id documentId,p.code documentCode,p.supplierId partnerId,s.code partnerCode,s.name partnerName,
          p.documentDate,p.dueDate,COALESCE(p.totalAmount,0) totalAmount,
          COALESCE((SELECT SUM(t.amount) FROM payable_transactions t WHERE t.sourceId=p.id AND t.supplierId=p.supplierId),0) outstanding
        FROM purchase_documents p JOIN suppliers s ON s.id=p.supplierId
        WHERE p.documentStatus='POSTED' AND (? IS NULL OR p.supplierId=?) AND (? IS NULL OR p.code LIKE ? OR s.code LIKE ? OR s.name LIKE ?)
        HAVING outstanding > 0.005 ORDER BY COALESCE(p.dueDate,p.documentDate),p.id`, query.partnerId || null, query.partnerId || null, search, search, search, search);
    const data = rows.map(row => {
      const due = row.dueDate ? new Date(row.dueDate) : null;
      const daysOverdue = due ? Math.max(0, Math.floor((asOf.getTime() - due.getTime()) / 86400000)) : 0;
      const outstanding = Number(row.outstanding);
      return { ...row, totalAmount: Number(row.totalAmount), outstanding, daysOverdue,
        bucket: daysOverdue === 0 ? "CURRENT" : daysOverdue <= 30 ? "1_30" : daysOverdue <= 60 ? "31_60" : daysOverdue <= 90 ? "61_90" : "OVER_90" };
    });
    return { rows: data, summary: {
      total: data.reduce((sum, row) => sum + row.outstanding, 0),
      current: data.filter(row => row.bucket === "CURRENT").reduce((sum, row) => sum + row.outstanding, 0),
      days1To30: data.filter(row => row.bucket === "1_30").reduce((sum, row) => sum + row.outstanding, 0),
      days31To60: data.filter(row => row.bucket === "31_60").reduce((sum, row) => sum + row.outstanding, 0),
      days61To90: data.filter(row => row.bucket === "61_90").reduce((sum, row) => sum + row.outstanding, 0),
      over90: data.filter(row => row.bucket === "OVER_90").reduce((sum, row) => sum + row.outstanding, 0),
    } };
  },

  async list(kind: Kind, query: any) {
    const model: any = kind === "RECEIPT" ? prisma.payment_receipts : prisma.payment_vouchers;
    const partnerField = kind === "RECEIPT" ? "customerId" : "supplierId";
    const where: any = { sourceModule: "DEBT_V1", ...(query.status ? { status: query.status } : {}), ...(query.partnerId ? { [partnerField]: query.partnerId } : {}), ...(query.search ? { OR: [{ code: { contains: query.search } }, { note: { contains: query.search } }] } : {}) };
    const [rows, total] = await Promise.all([model.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.limit, take: query.limit }), model.count({ where })]);
    return { data: await Promise.all(rows.map((row: any) => hydrate(kind, row))), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  },

  async get(kind: Kind, id: bigint) {
    const row: any = await findPayment(kind, id);
    if (!row || row.sourceModule !== "DEBT_V1") throw new HttpError(404, "PAYMENT_NOT_FOUND", "Không tìm thấy phiếu thu/chi V1");
    return hydrate(kind, row);
  },

  async create(kind: Kind, input: DebtPaymentDraftInput, userId: number) {
    assertAllocationTotal(input); await validatePartner(kind, input.partnerId);
    const created: any = await prisma.$transaction(async tx => {
      if (kind === "RECEIPT") {
        const header = await tx.payment_receipts.create({ data: {
        code: code(kind, input.paymentDate), customerId: input.partnerId, receiptDate: dateAtNoon(input.paymentDate), method: input.method,
        amount: money(input.amount), direction: "RECEIPT", note: input.note, status: "DRAFT", sourceModule: "DEBT_V1", createdBy: userId,
        } });
        await tx.payment_receipt_allocations.createMany({ data: input.allocations.map(row => ({ paymentReceiptId: header.id, salesOrderId: row.documentId, amount: money(row.amount) })) });
        return header;
      }
      const header = await tx.payment_vouchers.create({ data: {
        code: code(kind, input.paymentDate), supplierId: input.partnerId, voucherDate: dateAtNoon(input.paymentDate), method: input.method,
        amount: money(input.amount), direction: "PAYMENT", note: input.note, status: "DRAFT", sourceModule: "DEBT_V1", createdBy: userId,
      } });
      await tx.payment_voucher_allocations.createMany({ data: input.allocations.map(row => ({ paymentVoucherId: header.id, purchaseDocumentId: row.documentId, amount: money(row.amount) })) });
      return header;
    });
    await prisma.audit_logs.create({ data: { action: kind === "RECEIPT" ? "Tạo phiếu thu v1" : "Tạo phiếu chi v1", details: created.code, userId, userName: String(userId), createdAt: nowIso() } });
    return this.get(kind, created.id);
  },

  async update(kind: Kind, id: bigint, input: DebtPaymentUpdateInput, userId: number) {
    assertAllocationTotal(input); await validatePartner(kind, input.partnerId);
    await prisma.$transaction(async tx => {
      const current = await lockPayment(tx, kind, id); assertVersion(current, input.version);
      if (current.status !== "DRAFT") throw new HttpError(409, "INVALID_STATUS", "Chỉ được sửa phiếu thu/chi đang nháp");
      if (kind === "RECEIPT") {
        await tx.payment_receipt_allocations.deleteMany({ where: { paymentReceiptId: id } });
        await tx.payment_receipts.update({ where: { id }, data: { customerId: input.partnerId, receiptDate: dateAtNoon(input.paymentDate), method: input.method, amount: money(input.amount), note: input.note, version: { increment: 1 } } });
        await tx.payment_receipt_allocations.createMany({ data: input.allocations.map(row => ({ paymentReceiptId: id, salesOrderId: row.documentId, amount: money(row.amount) })) });
      } else {
        await tx.payment_voucher_allocations.deleteMany({ where: { paymentVoucherId: id } });
        await tx.payment_vouchers.update({ where: { id }, data: { supplierId: input.partnerId, voucherDate: dateAtNoon(input.paymentDate), method: input.method, amount: money(input.amount), note: input.note, version: { increment: 1 } } });
        await tx.payment_voucher_allocations.createMany({ data: input.allocations.map(row => ({ paymentVoucherId: id, purchaseDocumentId: row.documentId, amount: money(row.amount) })) });
      }
      await tx.audit_logs.create({ data: { action: kind === "RECEIPT" ? "Cập nhật phiếu thu v1" : "Cập nhật phiếu chi v1", details: String(id), userId, userName: String(userId), createdAt: nowIso() } });
    });
    return this.get(kind, id);
  },

  async post(kind: Kind, id: bigint, version: number, userId: number) {
    await prisma.$transaction(async tx => {
      const current = await lockPayment(tx, kind, id); assertVersion(current, version);
      if (current.status !== "DRAFT") throw new HttpError(409, "INVALID_STATUS", "Chỉ được ghi sổ phiếu thu/chi đang nháp");
      const payment: any = kind === "RECEIPT" ? await tx.payment_receipts.findUnique({ where: { id } }) : await tx.payment_vouchers.findUnique({ where: { id } });
      const allocations: any[] = kind === "RECEIPT"
        ? await tx.payment_receipt_allocations.findMany({ where: { paymentReceiptId: id } })
        : await tx.payment_voucher_allocations.findMany({ where: { paymentVoucherId: id } });
      if (!allocations.length) throw new HttpError(409, "ALLOCATIONS_REQUIRED", "Phiếu chưa có phân bổ");
      const occurredAt = new Date(), now = nowIso();
      for (const allocation of allocations) {
        if (kind === "RECEIPT") {
          const rows = await tx.$queryRawUnsafe<any[]>("SELECT id,code,customerId,status,totalAmount,paidAmount FROM sales_orders WHERE id=? FOR UPDATE", allocation.salesOrderId);
          const document = rows[0];
          if (!document || document.status !== "FULFILLED") throw new HttpError(409, "DOCUMENT_NOT_POSTED", "Đơn bán chưa ghi sổ");
          if (Number(document.customerId) !== payment.customerId) throw new HttpError(409, "PARTNER_MISMATCH", "Đơn bán không thuộc khách hàng của phiếu thu");
          const amount = Number(allocation.amount), remaining = Number(document.totalAmount) - Number(document.paidAmount || 0);
          if (amount > remaining + 0.005) throw new HttpError(409, "ALLOCATION_EXCEEDS_DEBT", `Phân bổ vượt dư nợ ${document.code}`);
          const paid = Number(document.paidAmount || 0) + amount;
          await tx.sales_orders.update({ where: { id: document.id }, data: { paidAmount: paid, paymentStatus: paymentStatus(paid, Number(document.totalAmount)), version: { increment: 1 }, updatedAt: now } });
          await tx.receivable_transactions.create({ data: { customerId: payment.customerId, sourceType: "DEBT_RECEIPT", sourceId: document.id, sourceCode: document.code, entryType: "PAYMENT", amount: money(-amount), paymentDocumentId: payment.id, occurredAt, createdBy: userId } });
          await tx.customer_payments.create({ data: { customerId: payment.customerId, salesOrderId: document.id, paymentDate: payment.receiptDate.toISOString().slice(0, 10), amount, method: payment.method, note: payment.note, createdBy: userId, createdAt: now } });
        } else {
          const rows = await tx.$queryRawUnsafe<any[]>("SELECT id,code,supplierId,documentStatus,totalAmount,paidAmount FROM purchase_documents WHERE id=? FOR UPDATE", allocation.purchaseDocumentId);
          const document = rows[0];
          if (!document || document.documentStatus !== "POSTED") throw new HttpError(409, "DOCUMENT_NOT_POSTED", "Chứng từ mua chưa ghi sổ");
          if (Number(document.supplierId) !== payment.supplierId) throw new HttpError(409, "PARTNER_MISMATCH", "Chứng từ mua không thuộc nhà cung cấp của phiếu chi");
          const amount = Number(allocation.amount), remaining = Number(document.totalAmount) - Number(document.paidAmount || 0);
          if (amount > remaining + 0.005) throw new HttpError(409, "ALLOCATION_EXCEEDS_DEBT", `Phân bổ vượt dư nợ ${document.code}`);
          const paid = Number(document.paidAmount || 0) + amount;
          await tx.purchase_documents.update({ where: { id: document.id }, data: { paidAmount: paid, paymentStatus: paymentStatus(paid, Number(document.totalAmount)), version: { increment: 1 }, updatedAt: now } });
          await tx.payable_transactions.create({ data: { supplierId: payment.supplierId, sourceType: "DEBT_VOUCHER", sourceId: document.id, sourceCode: document.code, entryType: "PAYMENT", amount: money(-amount), paymentDocumentId: payment.id, occurredAt, createdBy: userId } });
          await tx.supplier_payments.create({ data: { supplierId: payment.supplierId, purchaseDocumentId: document.id, paymentDate: payment.voucherDate.toISOString().slice(0, 10), amount, method: payment.method, note: payment.note, createdBy: userId, createdAt: now } });
        }
      }
      if (kind === "RECEIPT") await tx.payment_receipts.update({ where: { id }, data: { status: "POSTED", postedAt: occurredAt, postedBy: userId, version: { increment: 1 } } });
      else await tx.payment_vouchers.update({ where: { id }, data: { status: "POSTED", postedAt: occurredAt, postedBy: userId, version: { increment: 1 } } });
      await tx.audit_logs.create({ data: { action: kind === "RECEIPT" ? "Ghi sổ phiếu thu v1" : "Ghi sổ phiếu chi v1", details: payment.code, userId, userName: String(userId), createdAt: now } });
    }, { timeout: 30_000 });
    return this.get(kind, id);
  },

  async cancel(kind: Kind, id: bigint, input: DebtCancelInput, userId: number) {
    await prisma.$transaction(async tx => {
      const current = await lockPayment(tx, kind, id); assertVersion(current, input.version);
      if (current.status !== "POSTED") throw new HttpError(409, "INVALID_STATUS", "Chỉ được hủy phiếu đã ghi sổ");
      const payment: any = kind === "RECEIPT" ? await tx.payment_receipts.findUnique({ where: { id } }) : await tx.payment_vouchers.findUnique({ where: { id } });
      const allocations: any[] = kind === "RECEIPT"
        ? await tx.payment_receipt_allocations.findMany({ where: { paymentReceiptId: id } })
        : await tx.payment_voucher_allocations.findMany({ where: { paymentVoucherId: id } });
      const now = nowIso(), cancelledAt = new Date(), reversalCode = `H-${payment.code}`;
      let reversalId: bigint;
      if (kind === "RECEIPT") {
        const reversal = await tx.payment_receipts.create({ data: { code: reversalCode, customerId: payment.customerId, receiptDate: cancelledAt, method: payment.method, amount: payment.amount, direction: "REVERSAL", note: `Đảo ${payment.code}: ${input.reason}`, status: "POSTED", sourceModule: "DEBT_REVERSAL_V1", postedAt: cancelledAt, postedBy: userId, createdBy: userId } });
        await tx.payment_receipt_allocations.createMany({ data: allocations.map(row => ({ paymentReceiptId: reversal.id, salesOrderId: row.salesOrderId, amount: money(-Number(row.amount)) })) });
        reversalId = reversal.id;
        for (const allocation of allocations) {
          const rows = await tx.$queryRawUnsafe<any[]>("SELECT id,code,customerId,totalAmount,paidAmount FROM sales_orders WHERE id=? FOR UPDATE", allocation.salesOrderId); const document = rows[0];
          const amount = Number(allocation.amount), paid = Math.max(0, Number(document.paidAmount || 0) - amount);
          await tx.sales_orders.update({ where: { id: document.id }, data: { paidAmount: paid, paymentStatus: paymentStatus(paid, Number(document.totalAmount)), version: { increment: 1 }, updatedAt: now } });
          const original = await tx.receivable_transactions.findFirst({ where: { sourceType: "DEBT_RECEIPT", sourceId: document.id, paymentDocumentId: payment.id, entryType: "PAYMENT" } });
          if (!original) throw new HttpError(409, "PAYMENT_LEDGER_NOT_FOUND", `Không tìm thấy ledger phiếu thu cho ${document.code}`);
          await tx.receivable_transactions.create({ data: { customerId: payment.customerId, sourceType: "DEBT_RECEIPT_CANCEL", sourceId: document.id, sourceCode: document.code, entryType: "PAYMENT_REVERSAL", amount: money(amount), paymentDocumentId: reversal.id, reversalOfId: original.id, occurredAt: cancelledAt, createdBy: userId } });
          await tx.customer_payments.create({ data: { customerId: payment.customerId, salesOrderId: document.id, paymentDate: now.slice(0, 10), amount: -amount, method: payment.method, note: `Đảo ${payment.code}`, createdBy: userId, createdAt: now } });
        }
        await tx.payment_receipts.update({ where: { id }, data: { status: "CANCELLED", cancelledAt, cancelledBy: userId, cancelReason: input.reason, reversalReceiptId: reversal.id, version: { increment: 1 } } });
      } else {
        const reversal = await tx.payment_vouchers.create({ data: { code: reversalCode, supplierId: payment.supplierId, voucherDate: cancelledAt, method: payment.method, amount: payment.amount, direction: "REVERSAL", note: `Đảo ${payment.code}: ${input.reason}`, status: "POSTED", sourceModule: "DEBT_REVERSAL_V1", postedAt: cancelledAt, postedBy: userId, createdBy: userId } });
        await tx.payment_voucher_allocations.createMany({ data: allocations.map(row => ({ paymentVoucherId: reversal.id, purchaseDocumentId: row.purchaseDocumentId, amount: money(-Number(row.amount)) })) });
        reversalId = reversal.id;
        for (const allocation of allocations) {
          const rows = await tx.$queryRawUnsafe<any[]>("SELECT id,code,supplierId,totalAmount,paidAmount FROM purchase_documents WHERE id=? FOR UPDATE", allocation.purchaseDocumentId); const document = rows[0];
          const amount = Number(allocation.amount), paid = Math.max(0, Number(document.paidAmount || 0) - amount);
          await tx.purchase_documents.update({ where: { id: document.id }, data: { paidAmount: paid, paymentStatus: paymentStatus(paid, Number(document.totalAmount)), version: { increment: 1 }, updatedAt: now } });
          const original = await tx.payable_transactions.findFirst({ where: { sourceType: "DEBT_VOUCHER", sourceId: document.id, paymentDocumentId: payment.id, entryType: "PAYMENT" } });
          if (!original) throw new HttpError(409, "PAYMENT_LEDGER_NOT_FOUND", `Không tìm thấy ledger phiếu chi cho ${document.code}`);
          await tx.payable_transactions.create({ data: { supplierId: payment.supplierId, sourceType: "DEBT_VOUCHER_CANCEL", sourceId: document.id, sourceCode: document.code, entryType: "PAYMENT_REVERSAL", amount: money(amount), paymentDocumentId: reversal.id, reversalOfId: original.id, occurredAt: cancelledAt, createdBy: userId } });
          await tx.supplier_payments.create({ data: { supplierId: payment.supplierId, purchaseDocumentId: document.id, paymentDate: now.slice(0, 10), amount: -amount, method: payment.method, note: `Đảo ${payment.code}`, createdBy: userId, createdAt: now } });
        }
        await tx.payment_vouchers.update({ where: { id }, data: { status: "CANCELLED", cancelledAt, cancelledBy: userId, cancelReason: input.reason, reversalVoucherId: reversal.id, version: { increment: 1 } } });
      }
      void reversalId;
      await tx.audit_logs.create({ data: { action: kind === "RECEIPT" ? "Hủy phiếu thu v1" : "Hủy phiếu chi v1", details: `${payment.code}: ${input.reason}`, userId, userName: String(userId), createdAt: now } });
    }, { timeout: 30_000 });
    return this.get(kind, id);
  },
};