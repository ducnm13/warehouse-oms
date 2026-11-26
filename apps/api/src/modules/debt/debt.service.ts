import type { DebtCancelInput, DebtPaymentDraftInput, DebtPaymentUpdateInput } from "@challenge/contracts";
import { money, toDecimal } from "@challenge/database";
import type { DecimalInput } from "@challenge/database";
import { HttpError } from "../../common/http-error";
import { mapPayment } from "./debt.mapper";
import { debtRepository, prisma } from "./debt.repository";
import { FIELD_LABELS, diffFields, recordAudit, snapshotFields, type AuditField, type AuditChange } from "../../common/audit";

type Kind = "RECEIPT" | "VOUCHER";
const AUDIT_FIELDS: AuditField[] = [
  { key: "code", label: FIELD_LABELS.code },
  { key: "receiptDate", label: "Ngày phiếu thu" },
  { key: "voucherDate", label: "Ngày phiếu chi" },
  { key: "method", label: "Phương thức" },
  { key: "amount", label: "Số tiền" },
  { key: "note", label: FIELD_LABELS.note },
  { key: "status", label: FIELD_LABELS.status },
];
const entityType = (kind: Kind) => kind === "RECEIPT" ? "DEBT_RECEIPT" : "DEBT_VOUCHER";
const entityLabel = (kind: Kind) => kind === "RECEIPT" ? "phiếu thu" : "phiếu chi";

async function loadPayment(tx: any, kind: Kind, id: bigint) {
  return kind === "RECEIPT"
    ? tx.payment_receipts.findUnique({ where: { id }, include: { payment_receipt_allocations: true } })
    : tx.payment_vouchers.findUnique({ where: { id }, include: { payment_voucher_allocations: true } });
}

function allocationChanges(kind: Kind, before: any, after: any): AuditChange[] {
  if (!before || !after) return [];
  const beforeRows = kind === "RECEIPT" ? before.payment_receipt_allocations : before.payment_voucher_allocations;
  const afterRows = kind === "RECEIPT" ? after.payment_receipt_allocations : after.payment_voucher_allocations;
  const changes: AuditChange[] = [];
  const length = Math.max(beforeRows?.length || 0, afterRows?.length || 0);
  for (let index = 0; index < length; index++) {
    const oldRow = beforeRows?.[index];
    const newRow = afterRows?.[index];
    const documentKey = kind === "RECEIPT" ? "salesOrderId" : "purchaseDocumentId";
    if (!oldRow || !newRow || oldRow[documentKey] !== newRow[documentKey]) {
      changes.push({
        field: `allocations[${index}].documentId`,
        label: `Phân bổ ${index + 1} - Chứng từ`,
        oldValue: oldRow?.[documentKey] ?? null,
        newValue: newRow?.[documentKey] ?? null,
      });
    }
    if (oldRow && newRow && String(oldRow.amount) !== String(newRow.amount)) {
      changes.push({
        field: `allocations[${index}].amount`,
        label: `Phân bổ ${index + 1} - Số tiền`,
        oldValue: oldRow.amount,
        newValue: newRow.amount,
      });
    }
  }
  return changes;
}
const nowIso = () => new Date().toISOString();
const dateAtNoon = (value: string) => new Date(`${value}T12:00:00.000Z`);
const code = (kind: Kind, date: string) => `${kind === "RECEIPT" ? "PTV1" : "PCV1"}-${date.replaceAll("-", "")}-${Date.now().toString().slice(-6)}`;
const table = (kind: Kind) => kind === "RECEIPT" ? "payment_receipts" : "payment_vouchers";
const EPSILON = toDecimal("0.005");

async function lockPayment(tx: any, kind: Kind, id: bigint) {
  const rows = await tx.$queryRawUnsafe(`SELECT id,status,version,sourceModule FROM ${table(kind)} WHERE id=? FOR UPDATE`, id) as any[];
  if (!rows[0] || (rows[0].sourceModule && rows[0].sourceModule !== "DEBT_V1")) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Không tìm thấy phiếu thu/chi");
  return rows[0];
}
const assertVersion = (row: any, version: number) => { if (Number(row.version) !== version) throw new HttpError(409, "VERSION_CONFLICT", "Dữ liệu đã được người khác cập nhật"); };
const paymentStatus = (paid: DecimalInput, total: DecimalInput) => {
  const paidValue = toDecimal(paid);
  return paidValue.lte(EPSILON) ? "UNPAID" : paidValue.gte(toDecimal(total).minus(EPSILON)) ? "PAID" : "PARTIAL";
};
const maxZero = (value: DecimalInput) => {
  const decimal = toDecimal(value);
  return decimal.lt(0) ? money(0) : money(decimal);
};

async function validatePartner(kind: Kind, partnerId: number) {
  const partner = kind === "RECEIPT" ? await debtRepository.customer(partnerId) : await debtRepository.supplier(partnerId);
  if (!partner) throw new HttpError(422, "PARTNER_NOT_FOUND", "Khách hàng/nhà cung cấp không tồn tại");
}

function assertAllocationTotal(input: DebtPaymentDraftInput) {
  const allocated = input.allocations.reduce((sum, row) => sum.add(money(row.amount)), money(0));
  if (allocated.minus(money(input.amount)).abs().gt(EPSILON)) throw new HttpError(422, "ALLOCATION_TOTAL_MISMATCH", "Tổng phân bổ phải bằng số tiền phiếu");
}

async function hydrate(kind: Kind, row: any) {
  if (!row) return null;
  if (kind === "RECEIPT") {
    if (!row.id) return mapPayment({ ...row, id: `sale-${row.salesOrderId || row.sourceId || row.code}`, partnerCode: row.partnerCode, partnerName: row.partnerName, paymentDate: row.paymentDate || row.receiptDate, allocations: row.allocations || [] }, kind);
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
        WHERE s.status IN ('POSTED','FULFILLED') AND (? IS NULL OR s.customerId=?) AND (? IS NULL OR s.code LIKE ? OR c.code LIKE ? OR c.name LIKE ?)
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
    const where: any = {
      ...(query.sourceModule ? { sourceModule: query.sourceModule } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.partnerId ? { [partnerField]: query.partnerId } : {}),
      ...(query.search ? { OR: [{ code: { contains: query.search } }, { note: { contains: query.search } }] } : {}),
    };
    const [rows, total] = await Promise.all([model.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.limit, take: query.limit }), model.count({ where })]);
    const hydrated = await Promise.all(rows.map((row: any) => hydrate(kind, row)));
    if (kind === "RECEIPT" && !query.status) {
      const salePayments = await prisma.$queryRawUnsafe<any[]>(`SELECT s.id salesOrderId,s.code,s.customerId,c.code partnerCode,c.name partnerName,
          s.orderDate paymentDate,s.paymentMethod method,s.paidAmount amount,s.totalAmount
        FROM sales_orders s JOIN customers c ON c.id=s.customerId
        WHERE s.status IN ('POSTED','FULFILLED') AND COALESCE(s.paidAmount,0) > 0.005
        AND NOT EXISTS (
          SELECT 1 FROM payment_receipt_allocations a JOIN payment_receipts r ON r.id=a.paymentReceiptId
          WHERE a.salesOrderId=s.id AND r.status <> 'CANCELLED'
        )
        ${query.search ? "AND (s.code LIKE ? OR c.code LIKE ? OR c.name LIKE ?)" : ""}
        ORDER BY s.id DESC LIMIT 100`, ...(query.search ? [`%${query.search}%`, `%${query.search}%`, `%${query.search}%`] : []));
      for (const payment of salePayments) {
        hydrated.push(await hydrate(kind, {
          salesOrderId: payment.salesOrderId,
          sourceId: payment.salesOrderId,
          code: `Thu ngay ${payment.code}`,
          kind,
          customerId: payment.customerId,
          partnerCode: payment.partnerCode,
          partnerName: payment.partnerName,
          paymentDate: payment.paymentDate,
          method: payment.method || "BANK",
          amount: payment.amount,
          direction: "RECEIPT",
          status: "POSTED",
          version: 1,
          sourceModule: "SALE_V1",
          note: `Thu ngay khi lưu ${payment.code}`,
          allocations: [{ id: `sale-${payment.salesOrderId}`, documentId: payment.salesOrderId, documentCode: payment.code, amount: payment.amount, totalAmount: payment.totalAmount, paidAmount: payment.amount }],
        }));
      }
    }
    return { data: hydrated, meta: { page: query.page, limit: query.limit, total: hydrated.length, totalPages: 1 } };
  },

  async get(kind: Kind, id: bigint) {
    const row: any = await findPayment(kind, id);
    if (!row || (row.sourceModule && row.sourceModule !== "DEBT_V1")) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Không tìm thấy phiếu thu/chi");
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
    await recordAudit(prisma, {
      action: kind === "RECEIPT" ? "Tạo phiếu thu v1" : "Tạo phiếu chi v1",
      details: created.code,
      entityType: entityType(kind),
      entityId: created.id,
      entityCode: created.code,
      userId,
      createdAt: nowIso(),
      changes: [
        ...snapshotFields(created, AUDIT_FIELDS),
        ...input.allocations.map((row, index) => ({
          field: `allocations[${index}].amount`,
          label: `Phân bổ ${index + 1} - Số tiền`,
          oldValue: null,
          newValue: money(row.amount).toString(),
        })),
      ],
    });
    return this.get(kind, created.id);
  },

  async update(kind: Kind, id: bigint, input: DebtPaymentUpdateInput, userId: number) {
    assertAllocationTotal(input); await validatePartner(kind, input.partnerId);
    await prisma.$transaction(async tx => {
      const current = await lockPayment(tx, kind, id); assertVersion(current, input.version);
      if (current.status !== "DRAFT") throw new HttpError(409, "INVALID_STATUS", "Chỉ được sửa phiếu thu/chi đang nháp");
      const before = await loadPayment(tx, kind, id);
      if (kind === "RECEIPT") {
        await tx.payment_receipt_allocations.deleteMany({ where: { paymentReceiptId: id } });
        await tx.payment_receipts.update({ where: { id }, data: { customerId: input.partnerId, receiptDate: dateAtNoon(input.paymentDate), method: input.method, amount: money(input.amount), note: input.note, version: { increment: 1 } } });
        await tx.payment_receipt_allocations.createMany({ data: input.allocations.map(row => ({ paymentReceiptId: id, salesOrderId: row.documentId, amount: money(row.amount) })) });
      } else {
        await tx.payment_voucher_allocations.deleteMany({ where: { paymentVoucherId: id } });
        await tx.payment_vouchers.update({ where: { id }, data: { supplierId: input.partnerId, voucherDate: dateAtNoon(input.paymentDate), method: input.method, amount: money(input.amount), note: input.note, version: { increment: 1 } } });
        await tx.payment_voucher_allocations.createMany({ data: input.allocations.map(row => ({ paymentVoucherId: id, purchaseDocumentId: row.documentId, amount: money(row.amount) })) });
      }
      const after = await loadPayment(tx, kind, id);
      await recordAudit(tx, {
        action: kind === "RECEIPT" ? "Cập nhật phiếu thu v1" : "Cập nhật phiếu chi v1",
        details: after?.code || String(id),
        entityType: entityType(kind),
        entityId: id,
        entityCode: after?.code,
        userId,
        createdAt: nowIso(),
        changes: [
          ...diffFields(before, after, AUDIT_FIELDS),
          ...allocationChanges(kind, before, after),
        ],
      });
    });
    return this.get(kind, id);
  },

  async post(kind: Kind, id: bigint, version: number, userId: number) {
    await prisma.$transaction(async tx => {
      const current = await lockPayment(tx, kind, id); assertVersion(current, version);
      if (current.status !== "DRAFT") throw new HttpError(409, "INVALID_STATUS", "Chỉ được lưu phiếu thu/chi đang nháp");
      const payment: any = kind === "RECEIPT" ? await tx.payment_receipts.findUnique({ where: { id } }) : await tx.payment_vouchers.findUnique({ where: { id } });
      const allocations: any[] = kind === "RECEIPT"
        ? await tx.payment_receipt_allocations.findMany({ where: { paymentReceiptId: id } })
        : await tx.payment_voucher_allocations.findMany({ where: { paymentVoucherId: id } });
      if (!allocations.length) throw new HttpError(409, "ALLOCATIONS_REQUIRED", "Phiếu chưa có phân bổ");
      const occurredAt = new Date(), now = nowIso();
      const allocationAudit: AuditChange[] = [];
      for (const allocation of allocations) {
        if (kind === "RECEIPT") {
          const rows = await tx.$queryRawUnsafe<any[]>("SELECT id,code,customerId,status,totalAmount,paidAmount FROM sales_orders WHERE id=? FOR UPDATE", allocation.salesOrderId);
          const document = rows[0];
          if (!document || !["POSTED", "FULFILLED"].includes(document.status)) throw new HttpError(409, "DOCUMENT_NOT_POSTED", "Đơn bán chưa lưu");
          if (Number(document.customerId) !== payment.customerId) throw new HttpError(409, "PARTNER_MISMATCH", "Đơn bán không thuộc khách hàng của phiếu thu");
          const outstandingRows = await tx.$queryRawUnsafe<any[]>("SELECT COALESCE(SUM(amount),0) outstanding FROM receivable_transactions WHERE sourceId=? AND customerId=?", document.id, document.customerId);
          const amount = money(allocation.amount), remaining = toDecimal(outstandingRows[0]?.outstanding || 0);
          if (amount.gt(remaining.add(EPSILON))) throw new HttpError(409, "ALLOCATION_EXCEEDS_DEBT", `Phân bổ vượt dư nợ ${document.code}`);
          await tx.receivable_transactions.create({ data: { customerId: payment.customerId, sourceType: "DEBT_RECEIPT", sourceId: document.id, sourceCode: document.code, entryType: "PAYMENT", amount: amount.neg(), paymentDocumentId: payment.id, occurredAt, createdBy: userId } });
          const paid = money(toDecimal(document.paidAmount || 0).add(amount));
          allocationAudit.push({
            field: `allocations.${document.code}.paidAmount`,
            label: `${document.code} - Đã thanh toán`,
            oldValue: document.paidAmount,
            newValue: paid.toString(),
          });
          const remainingAfterRows = await tx.$queryRawUnsafe<any[]>("SELECT COALESCE(SUM(amount),0) outstanding FROM receivable_transactions WHERE sourceId=? AND customerId=?", document.id, document.customerId);
          const remainingAfter = toDecimal(remainingAfterRows[0]?.outstanding || 0);
          await tx.sales_orders.update({ where: { id: document.id }, data: { paidAmount: paid, paymentStatus: remainingAfter.lte(EPSILON) ? "PAID" : paid.gt(EPSILON) ? "PARTIAL" : "UNPAID", version: { increment: 1 }, updatedAt: now } });
          await tx.customer_payments.create({ data: { customerId: payment.customerId, salesOrderId: document.id, paymentDate: payment.receiptDate.toISOString().slice(0, 10), amount, method: payment.method, note: payment.note, createdBy: userId, createdAt: now } });
        } else {
          const rows = await tx.$queryRawUnsafe<any[]>("SELECT id,code,supplierId,documentStatus,totalAmount,paidAmount FROM purchase_documents WHERE id=? FOR UPDATE", allocation.purchaseDocumentId);
          const document = rows[0];
          if (!document || document.documentStatus !== "POSTED") throw new HttpError(409, "DOCUMENT_NOT_POSTED", "Chứng từ mua chưa lưu");
          if (Number(document.supplierId) !== payment.supplierId) throw new HttpError(409, "PARTNER_MISMATCH", "Chứng từ mua không thuộc nhà cung cấp của phiếu chi");
          const amount = money(allocation.amount), remaining = money(toDecimal(document.totalAmount).minus(toDecimal(document.paidAmount || 0)));
          if (amount.gt(remaining.add(EPSILON))) throw new HttpError(409, "ALLOCATION_EXCEEDS_DEBT", `Phân bổ vượt dư nợ ${document.code}`);
          const paid = money(toDecimal(document.paidAmount || 0).add(amount));
          allocationAudit.push({
            field: `allocations.${document.code}.paidAmount`,
            label: `${document.code} - Đã thanh toán`,
            oldValue: document.paidAmount,
            newValue: paid.toString(),
          });
          await tx.purchase_documents.update({ where: { id: document.id }, data: { paidAmount: paid, paymentStatus: paymentStatus(paid, document.totalAmount), version: { increment: 1 }, updatedAt: now } });
          await tx.payable_transactions.create({ data: { supplierId: payment.supplierId, sourceType: "DEBT_VOUCHER", sourceId: document.id, sourceCode: document.code, entryType: "PAYMENT", amount: amount.neg(), paymentDocumentId: payment.id, occurredAt, createdBy: userId } });
          await tx.supplier_payments.create({ data: { supplierId: payment.supplierId, purchaseDocumentId: document.id, paymentDate: payment.voucherDate.toISOString().slice(0, 10), amount, method: payment.method, note: payment.note, createdBy: userId, createdAt: now } });
        }
      }
      if (kind === "RECEIPT") await tx.payment_receipts.update({ where: { id }, data: { status: "POSTED", postedAt: occurredAt, postedBy: userId, version: { increment: 1 } } });
      else await tx.payment_vouchers.update({ where: { id }, data: { status: "POSTED", postedAt: occurredAt, postedBy: userId, version: { increment: 1 } } });
      await recordAudit(tx, {
        action: kind === "RECEIPT" ? "Lưu phiếu thu v1" : "Lưu phiếu chi v1",
        details: payment.code,
        entityType: entityType(kind),
        entityId: id,
        entityCode: payment.code,
        userId,
        createdAt: now,
        changes: [
          { field: "status", label: FIELD_LABELS.status, oldValue: payment.status, newValue: "POSTED" },
          ...allocationAudit,
        ],
      });
    }, { timeout: 30_000 });
    return this.get(kind, id);
  },

  async cancel(kind: Kind, id: bigint, input: DebtCancelInput, userId: number) {
    await prisma.$transaction(async tx => {
      const current = await lockPayment(tx, kind, id); assertVersion(current, input.version);
      if (current.status !== "POSTED") throw new HttpError(409, "INVALID_STATUS", "Chỉ được hủy phiếu đã lưu");
      const payment: any = kind === "RECEIPT" ? await tx.payment_receipts.findUnique({ where: { id } }) : await tx.payment_vouchers.findUnique({ where: { id } });
      const allocations: any[] = kind === "RECEIPT"
        ? await tx.payment_receipt_allocations.findMany({ where: { paymentReceiptId: id } })
        : await tx.payment_voucher_allocations.findMany({ where: { paymentVoucherId: id } });
      const now = nowIso(), cancelledAt = new Date(), reversalCode = `H-${payment.code}`;
      let reversalId: bigint;
      const allocationAudit: AuditChange[] = [];
      if (kind === "RECEIPT") {
        const reversal = await tx.payment_receipts.create({ data: { code: reversalCode, customerId: payment.customerId, receiptDate: cancelledAt, method: payment.method, amount: payment.amount, direction: "REVERSAL", note: `Đảo ${payment.code}: ${input.reason}`, status: "POSTED", sourceModule: "DEBT_REVERSAL_V1", postedAt: cancelledAt, postedBy: userId, createdBy: userId } });
        await tx.payment_receipt_allocations.createMany({ data: allocations.map(row => ({ paymentReceiptId: reversal.id, salesOrderId: row.salesOrderId, amount: money(-Number(row.amount)) })) });
        reversalId = reversal.id;
        for (const allocation of allocations) {
          const rows = await tx.$queryRawUnsafe<any[]>("SELECT id,code,customerId,totalAmount,paidAmount FROM sales_orders WHERE id=? FOR UPDATE", allocation.salesOrderId); const document = rows[0];
          const amount = money(allocation.amount);
          const paid = maxZero(toDecimal(document.paidAmount || 0).minus(amount));
          allocationAudit.push({
            field: `allocations.${document.code}.paidAmount`,
            label: `${document.code} - Đã thanh toán`,
            oldValue: document.paidAmount,
            newValue: paid.toString(),
          });
          let original = await tx.receivable_transactions.findFirst({ where: { sourceType: "DEBT_RECEIPT", sourceId: document.id, paymentDocumentId: payment.id, entryType: "PAYMENT" } });
          if (!original) {
            original = await tx.receivable_transactions.findFirst({ where: { sourceType: "SALE_PAYMENT", sourceId: document.id, entryType: "PAYMENT" }, orderBy: { id: "desc" } });
          }
          if (!original) throw new HttpError(409, "PAYMENT_LEDGER_NOT_FOUND", `Không tìm thấy ledger phiếu thu cho ${document.code}`);
          await tx.receivable_transactions.create({ data: { customerId: payment.customerId, sourceType: "DEBT_RECEIPT_CANCEL", sourceId: document.id, sourceCode: document.code, entryType: "PAYMENT_REVERSAL", amount, paymentDocumentId: reversal.id, reversalOfId: original.id, occurredAt: cancelledAt, createdBy: userId } });
          const remainingAfterRows = await tx.$queryRawUnsafe<any[]>("SELECT COALESCE(SUM(amount),0) outstanding FROM receivable_transactions WHERE sourceId=? AND customerId=?", document.id, document.customerId);
          const remainingAfter = toDecimal(remainingAfterRows[0]?.outstanding || 0);
          await tx.sales_orders.update({ where: { id: document.id }, data: { paidAmount: paid, paymentStatus: remainingAfter.lte(EPSILON) ? "PAID" : paid.gt(EPSILON) ? "PARTIAL" : "UNPAID", version: { increment: 1 }, updatedAt: now } });
          await tx.customer_payments.create({ data: { customerId: payment.customerId, salesOrderId: document.id, paymentDate: now.slice(0, 10), amount: amount.neg(), method: payment.method, note: `Đảo ${payment.code}`, createdBy: userId, createdAt: now } });
        }
        await tx.payment_receipts.update({ where: { id }, data: { status: "CANCELLED", cancelledAt, cancelledBy: userId, cancelReason: input.reason, reversalReceiptId: reversal.id, version: { increment: 1 } } });
      } else {
        const reversal = await tx.payment_vouchers.create({ data: { code: reversalCode, supplierId: payment.supplierId, voucherDate: cancelledAt, method: payment.method, amount: payment.amount, direction: "REVERSAL", note: `Đảo ${payment.code}: ${input.reason}`, status: "POSTED", sourceModule: "DEBT_REVERSAL_V1", postedAt: cancelledAt, postedBy: userId, createdBy: userId } });
        await tx.payment_voucher_allocations.createMany({ data: allocations.map(row => ({ paymentVoucherId: reversal.id, purchaseDocumentId: row.purchaseDocumentId, amount: money(-Number(row.amount)) })) });
        reversalId = reversal.id;
        for (const allocation of allocations) {
          const rows = await tx.$queryRawUnsafe<any[]>("SELECT id,code,supplierId,totalAmount,paidAmount FROM purchase_documents WHERE id=? FOR UPDATE", allocation.purchaseDocumentId); const document = rows[0];
          const amount = money(allocation.amount);
          const paid = maxZero(toDecimal(document.paidAmount || 0).minus(amount));
          allocationAudit.push({
            field: `allocations.${document.code}.paidAmount`,
            label: `${document.code} - Đã thanh toán`,
            oldValue: document.paidAmount,
            newValue: paid.toString(),
          });
          await tx.purchase_documents.update({ where: { id: document.id }, data: { paidAmount: paid, paymentStatus: paymentStatus(paid, document.totalAmount), version: { increment: 1 }, updatedAt: now } });
          const original = await tx.payable_transactions.findFirst({ where: { sourceType: "DEBT_VOUCHER", sourceId: document.id, paymentDocumentId: payment.id, entryType: "PAYMENT" } });
          if (!original) throw new HttpError(409, "PAYMENT_LEDGER_NOT_FOUND", `Không tìm thấy ledger phiếu chi cho ${document.code}`);
          await tx.payable_transactions.create({ data: { supplierId: payment.supplierId, sourceType: "DEBT_VOUCHER_CANCEL", sourceId: document.id, sourceCode: document.code, entryType: "PAYMENT_REVERSAL", amount, paymentDocumentId: reversal.id, reversalOfId: original.id, occurredAt: cancelledAt, createdBy: userId } });
          await tx.supplier_payments.create({ data: { supplierId: payment.supplierId, purchaseDocumentId: document.id, paymentDate: now.slice(0, 10), amount: amount.neg(), method: payment.method, note: `Đảo ${payment.code}`, createdBy: userId, createdAt: now } });
        }
        await tx.payment_vouchers.update({ where: { id }, data: { status: "CANCELLED", cancelledAt, cancelledBy: userId, cancelReason: input.reason, reversalVoucherId: reversal.id, version: { increment: 1 } } });
      }
      void reversalId;
      await recordAudit(tx, {
        action: kind === "RECEIPT" ? "Hủy phiếu thu v1" : "Hủy phiếu chi v1",
        details: `${payment.code}: ${input.reason}`,
        entityType: entityType(kind),
        entityId: id,
        entityCode: payment.code,
        userId,
        createdAt: now,
        changes: [
          { field: "status", label: FIELD_LABELS.status, oldValue: payment.status, newValue: "CANCELLED" },
          { field: "cancelReason", label: FIELD_LABELS.reason, oldValue: null, newValue: input.reason },
          ...allocationAudit,
        ],
      });
    }, { timeout: 30_000 });
    return this.get(kind, id);
  },
};