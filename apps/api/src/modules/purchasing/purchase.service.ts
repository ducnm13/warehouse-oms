import { Prisma } from "@challenge/database";
import type { PurchaseCancelInput, PurchaseDraftInput, PurchaseUpdateInput } from "@challenge/contracts";
import { HttpError } from "../../common/http-error";
import { mapPurchaseDocument } from "./purchase.mapper";
import { prisma, purchaseInclude, purchaseRepository } from "./purchase.repository";

const decimal = (value: number) => new Prisma.Decimal(value.toFixed(4));
const money = (value: number) => new Prisma.Decimal(value.toFixed(2));
const dateAtNoon = (date: string) => new Date(`${date}T12:00:00.000Z`);
const nowIso = () => new Date().toISOString();

function calculate(input: PurchaseDraftInput) {
  const details = input.details.map(line => {
    const lineAmount = line.quantity * line.unitPrice;
    const taxAmount = lineAmount * line.taxRate / 100;
    return { ...line, lineAmount, taxAmount };
  });
  const goodsAmount = details.reduce((sum, line) => sum + line.lineAmount, 0);
  const taxAmount = details.reduce((sum, line) => sum + line.taxAmount, 0);
  const totalAmount = goodsAmount + taxAmount + input.purchaseCost;
  return { details, goodsAmount, taxAmount, totalAmount, inventoryValue: input.type === "DOMESTIC_INVENTORY" ? goodsAmount + input.purchaseCost : 0 };
}

async function validateMasterData(input: PurchaseDraftInput) {
  const supplier = await purchaseRepository.supplierExists(input.supplierId);
  if (!supplier) throw new HttpError(422, "SUPPLIER_NOT_FOUND", "Nhà cung cấp không tồn tại");
  const refs = await purchaseRepository.validateReferences(input.details);
  input.details.forEach((line, index) => {
    if (!refs.packagingIds.has(line.packagingId)) throw new HttpError(422, "ITEM_NOT_FOUND", `Hàng hóa dòng ${index + 1} không tồn tại`);
    if (line.warehouseId && !refs.warehouseIds.has(line.warehouseId)) throw new HttpError(422, "WAREHOUSE_NOT_FOUND", `Kho dòng ${index + 1} không tồn tại`);
  });
  return supplier;
}

const lineData = (line: ReturnType<typeof calculate>["details"][number]) => ({
  packagingId: line.packagingId,
  warehouseId: line.warehouseId || null,
  quantity: line.quantity,
  unitPrice: line.unitPrice,
  taxRate: line.taxRate,
  lineAmount: line.lineAmount,
  taxAmount: line.taxAmount,
  note: line.note || "",
});

export const purchaseService = {
  async list(query: { page: number; limit: number; search?: string; status?: string }) {
    const where: any = { deletedAt: null };
    if (query.status) where.documentStatus = query.status;
    if (query.search) where.OR = [{ code: { contains: query.search } }, { suppliers: { name: { contains: query.search } } }];
    const [rows, total] = await Promise.all([
      purchaseRepository.list(where, (query.page - 1) * query.limit, query.limit), purchaseRepository.count(where),
    ]);
    return { data: rows.map(mapPurchaseDocument), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  },
  async get(id: number) {
    const row = await purchaseRepository.findById(id);
    if (!row || row.deletedAt) throw new HttpError(404, "PURCHASE_NOT_FOUND", "Không tìm thấy chứng từ mua hàng");
    return mapPurchaseDocument(row);
  },
  async createDraft(input: PurchaseDraftInput, userId: number, fullName: string) {
    const supplier = await validateMasterData(input);
    const totals = calculate(input);
    const dueDate = input.dueDate || new Date(dateAtNoon(input.documentDate).getTime() + Number(supplier.paymentTermDays || 0) * 86400000).toISOString().slice(0, 10);
    const code = `MH-${input.documentDate.replaceAll("-", "")}-${Date.now().toString().slice(-6)}`;
    const row = await purchaseRepository.create({
      code, documentDate: input.documentDate, dueDate, type: input.type,
      documentStatus: "DRAFT", paymentStatus: "UNPAID", paymentIntent: input.paymentIntent,
      paymentMethod: input.paymentMethod, invoiceOption: input.invoiceOption, deliveryPerson: input.deliveryPerson,
      buyerName: input.buyerName || fullName, description: input.description,
      goodsAmount: totals.goodsAmount, taxAmount: totals.taxAmount, purchaseCost: input.purchaseCost,
      totalAmount: totals.totalAmount, inventoryValue: totals.inventoryValue, paidAmount: 0,
      createdAt: nowIso(), updatedAt: nowIso(), suppliers: { connect: { id: input.supplierId } },
      users: { connect: { id: userId } }, purchase_document_details: { create: totals.details.map(lineData) },
    } as any);
    return mapPurchaseDocument(row);
  },
  async updateDraft(id: number, input: PurchaseUpdateInput, userId: number) {
    await validateMasterData(input);
    const totals = calculate(input);
    return prisma.$transaction(async tx => {
      const locked = await tx.$queryRawUnsafe<any[]>("SELECT id,documentStatus,version FROM purchase_documents WHERE id=? FOR UPDATE", id);
      const current = locked[0];
      if (!current) throw new HttpError(404, "PURCHASE_NOT_FOUND", "Không tìm thấy chứng từ");
      if (current.documentStatus !== "DRAFT") throw new HttpError(409, "PURCHASE_NOT_DRAFT", "Chỉ được sửa chứng từ nháp");
      if (Number(current.version) !== input.version) throw new HttpError(409, "VERSION_CONFLICT", "Chứng từ đã được người khác cập nhật");
      await tx.purchase_document_details.deleteMany({ where: { documentId: id } });
      const updated = await tx.purchase_documents.update({
        where: { id },
        data: {
          documentDate: input.documentDate, dueDate: input.dueDate || null, type: input.type,
          paymentIntent: input.paymentIntent, paymentMethod: input.paymentMethod, invoiceOption: input.invoiceOption,
          supplierId: input.supplierId, deliveryPerson: input.deliveryPerson, buyerName: input.buyerName,
          description: input.description, goodsAmount: totals.goodsAmount, taxAmount: totals.taxAmount,
          purchaseCost: input.purchaseCost, totalAmount: totals.totalAmount, inventoryValue: totals.inventoryValue,
          version: { increment: 1 }, updatedAt: nowIso(), purchase_document_details: { create: totals.details.map(lineData) },
        }, include: purchaseInclude,
      });
      await tx.audit_logs.create({ data: { action: "Cập nhật nháp mua hàng v1", details: updated.code, userId, userName: String(userId), createdAt: nowIso() } });
      return mapPurchaseDocument(updated);
    });
  },
  async post(id: number, version: number, userId: number) {
    return prisma.$transaction(async tx => {
      const locked = await tx.$queryRawUnsafe<any[]>("SELECT id,documentStatus,version FROM purchase_documents WHERE id=? FOR UPDATE", id);
      const current = locked[0];
      if (!current) throw new HttpError(404, "PURCHASE_NOT_FOUND", "Không tìm thấy chứng từ");
      if (current.documentStatus !== "DRAFT") throw new HttpError(409, "PURCHASE_ALREADY_POSTED", "Chứng từ không còn ở trạng thái nháp");
      if (Number(current.version) !== version) throw new HttpError(409, "VERSION_CONFLICT", "Chứng từ đã được người khác cập nhật");
      const document = await tx.purchase_documents.findUnique({ where: { id }, include: purchaseInclude });
      if (!document || !document.purchase_document_details.length) throw new HttpError(422, "PURCHASE_EMPTY", "Chứng từ chưa có hàng hóa");
      const postedAt = new Date();
      const now = postedAt.toISOString();
      const links: Array<{ linkType: string; linkedId: bigint; linkedCode: string }> = [];

      if (document.type === "DOMESTIC_INVENTORY") {
        const groups = new Map<number, typeof document.purchase_document_details>();
        for (const line of document.purchase_document_details) {
          if (!line.warehouseId) throw new HttpError(422, "WAREHOUSE_REQUIRED", "Dòng nhập kho chưa chọn kho");
          groups.set(line.warehouseId, [...(groups.get(line.warehouseId) || []), line]);
        }
        for (const [warehouseId, lines] of groups) {
          const txCode = `PN-${document.code}-${warehouseId}`;
          const inventoryTransaction = await tx.inventorytransactions.create({
            data: {
              code: txCode, type: "IMPORT", transaction_date: document.documentDate, entry_date: document.documentDate,
              warehouseId, note: `Nhập kho theo chứng từ ${document.code}`, recipient: document.suppliers.name,
              reason: "Mua hàng v1", createdBy: userId, createdAt: now, updatedAt: now,
              inventorytransactiondetails: {
                create: lines.map(line => ({ packagingId: line.packagingId, quantity: Number(line.quantity), note: document.code, createdAt: now, updatedAt: now })),
              },
            },
          });
          await tx.purchase_inventory_links.create({
            data: { purchaseDocumentId: id, inventoryTransactionId: inventoryTransaction.id, warehouseId },
          });
          links.push({ linkType: "INVENTORY_RECEIPT", linkedId: BigInt(inventoryTransaction.id), linkedCode: txCode });
          for (const line of lines) {
            const quantity = Number(line.quantity);
            const lineAmount = Number(line.lineAmount || 0);
            const goodsAmount = Number(document.goodsAmount || 0);
            const allocatedCost = goodsAmount > 0 ? Number(document.purchaseCost || 0) * lineAmount / goodsAmount : 0;
            const inventoryValue = lineAmount + allocatedCost;
            const unitCost = quantity > 0 ? inventoryValue / quantity : 0;
            await tx.productwarehouses.upsert({
              where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId } },
              create: { packagingId: line.packagingId, warehouseId, stock_quantity: quantity, updatedAt: now },
              update: { stock_quantity: { increment: quantity }, updatedAt: now },
            });
            await tx.inventory_ledger.create({
              data: {
                sourceType: "PURCHASE", sourceId: id, sourceLineId: line.id, documentCode: document.code,
                direction: "IN", packagingId: line.packagingId, warehouseId, quantity: decimal(quantity),
                unitCost: decimal(unitCost), totalValue: money(inventoryValue), occurredAt: postedAt, createdBy: userId,
              },
            });
          }
        }
      }

      const payable = await tx.payable_transactions.create({
        data: {
          supplierId: document.supplierId, sourceType: "PURCHASE", sourceId: id, sourceCode: document.code,
          entryType: "CHARGE", amount: money(Number(document.totalAmount || 0)),
          dueDate: document.dueDate ? dateAtNoon(document.dueDate) : null,
          occurredAt: postedAt, createdBy: userId,
        },
      });
      links.push({ linkType: "PAYABLE_CHARGE", linkedId: payable.id, linkedCode: document.code });

      let paidAmount = 0;
      let paymentStatus = "UNPAID";
      if (document.paymentIntent === "PAID") {
        paidAmount = Number(document.totalAmount || 0);
        paymentStatus = "PAID";
        const voucherCode = `PC-${document.code}`;
        const voucher = await tx.payment_vouchers.create({
          data: {
            code: voucherCode, supplierId: document.supplierId, voucherDate: dateAtNoon(document.documentDate),
            method: document.paymentMethod || "CASH", amount: money(paidAmount), direction: "PAYMENT",
            note: `Thanh toán chứng từ ${document.code}`, status: "POSTED", createdBy: userId,
          },
        });
        await tx.payment_voucher_allocations.create({
          data: { paymentVoucherId: voucher.id, purchaseDocumentId: id, amount: money(paidAmount) },
        });
        await tx.payable_transactions.create({
          data: {
            supplierId: document.supplierId, sourceType: "PURCHASE_PAYMENT", sourceId: id, sourceCode: document.code,
            entryType: "PAYMENT", amount: money(-paidAmount), paymentDocumentId: voucher.id,
            occurredAt: postedAt, createdBy: userId,
          },
        });
        await tx.supplier_payments.create({
          data: {
            supplierId: document.supplierId, purchaseDocumentId: id, paymentDate: document.documentDate,
            amount: paidAmount, method: document.paymentMethod || "CASH", note: `Thanh toán v1 ${document.code}`,
            createdBy: userId, createdAt: now,
          },
        });
        links.push({ linkType: "PAYMENT_VOUCHER", linkedId: voucher.id, linkedCode: voucherCode });
      }

      for (const link of links) await tx.purchase_document_links_v1.create({ data: { purchaseDocumentId: id, ...link } });
      const updated = await tx.purchase_documents.update({
        where: { id },
        data: {
          documentStatus: "POSTED", postedAt, postedBy: userId, paymentStatus, paidAmount,
          inventoryTransactionId: links.find(link => link.linkType === "INVENTORY_RECEIPT") ? Number(links.find(link => link.linkType === "INVENTORY_RECEIPT")!.linkedId) : null,
          version: { increment: 1 }, updatedAt: now,
        }, include: purchaseInclude,
      });
      await tx.audit_logs.create({ data: { action: "Ghi sổ mua hàng v1", details: document.code, userId, userName: String(userId), createdAt: now } });
      return mapPurchaseDocument(updated);
    }, { timeout: 30_000 });
  },
  async cancel(id: number, input: PurchaseCancelInput, userId: number) {
    return prisma.$transaction(async tx => {
      const locked = await tx.$queryRawUnsafe<any[]>("SELECT id,documentStatus,version FROM purchase_documents WHERE id=? FOR UPDATE", id);
      const current = locked[0];
      if (!current) throw new HttpError(404, "PURCHASE_NOT_FOUND", "Không tìm thấy chứng từ");
      if (current.documentStatus !== "POSTED") throw new HttpError(409, "PURCHASE_NOT_POSTED", "Chỉ được hủy chứng từ đã ghi sổ");
      if (Number(current.version) !== input.version) throw new HttpError(409, "VERSION_CONFLICT", "Chứng từ đã được người khác cập nhật");
      const document = await tx.purchase_documents.findUnique({ where: { id }, include: purchaseInclude });
      if (!document) throw new HttpError(404, "PURCHASE_NOT_FOUND", "Không tìm thấy chứng từ");
      const debtPayments = await tx.$queryRawUnsafe<any[]>(`SELECT COUNT(*) count
        FROM payment_voucher_allocations a JOIN payment_vouchers v ON v.id=a.paymentVoucherId
        WHERE a.purchaseDocumentId=? AND v.sourceModule='DEBT_V1' AND v.status='POSTED'`, id);
      if (Number(debtPayments[0]?.count || 0) > 0) throw new HttpError(409, "DEBT_PAYMENT_EXISTS", "Hãy hủy phiếu chi công nợ V1 trước khi hủy chứng từ mua hàng");
      const originalLinks = await tx.purchase_document_links_v1.findMany({ where: { purchaseDocumentId: id } });
      if (!originalLinks.some(link => link.linkType === "PAYABLE_CHARGE")) {
        throw new HttpError(409, "LEGACY_PURCHASE_NOT_REVERSIBLE", "Chứng từ legacy chưa có ledger v1; không thể hủy tự động");
      }
      const cancelledAt = new Date();
      const now = cancelledAt.toISOString();
      const grouped = new Map<number, typeof document.purchase_document_details>();
      if (document.type === "DOMESTIC_INVENTORY") {
        for (const line of document.purchase_document_details) {
          if (!line.warehouseId) throw new HttpError(409, "MISSING_WAREHOUSE", "Dữ liệu kho của chứng từ không đầy đủ");
          const balance = await tx.productwarehouses.findUnique({ where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId: line.warehouseId } } });
          if (Number(balance?.stock_quantity || 0) < Number(line.quantity)) {
            throw new HttpError(409, "REVERSAL_STOCK_SHORTAGE", `Không đủ tồn để hủy dòng ${line.id}`);
          }
          grouped.set(line.warehouseId, [...(grouped.get(line.warehouseId) || []), line]);
        }
        for (const [warehouseId, lines] of grouped) {
          const reversalCode = `H-PN-${document.code}-${warehouseId}`;
          const reversalTransaction = await tx.inventorytransactions.create({
            data: {
              code: reversalCode, type: "EXPORT", transaction_date: now.slice(0, 10), exit_date: now.slice(0, 10),
              warehouseId, note: `Đảo phiếu nhập khi hủy ${document.code}`, recipient: document.suppliers.name,
              reason: "Hủy mua hàng v1", createdBy: userId, createdAt: now, updatedAt: now,
              inventorytransactiondetails: { create: lines.map(line => ({ packagingId: line.packagingId, quantity: Number(line.quantity), note: document.code, createdAt: now, updatedAt: now })) },
            },
          });
          await tx.purchase_document_links_v1.create({
            data: { purchaseDocumentId: id, linkType: "INVENTORY_REVERSAL", linkedId: BigInt(reversalTransaction.id), linkedCode: reversalCode },
          });
          for (const line of lines) {
            await tx.productwarehouses.update({
              where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId } },
              data: { stock_quantity: { decrement: Number(line.quantity) }, updatedAt: now },
            });
            const originalLedger = await tx.inventory_ledger.findFirst({ where: { sourceType: "PURCHASE", sourceId: id, sourceLineId: line.id, direction: "IN" } });
            await tx.inventory_ledger.create({
              data: {
                sourceType: "PURCHASE_CANCEL", sourceId: id, sourceLineId: line.id, documentCode: document.code,
                direction: "OUT", packagingId: line.packagingId, warehouseId, quantity: decimal(Number(line.quantity)),
                unitCost: originalLedger?.unitCost || decimal(0), totalValue: money(-Number(originalLedger?.totalValue || 0)),
                reversalOfId: originalLedger?.id, occurredAt: cancelledAt, createdBy: userId,
              },
            });
          }
        }
      }

      const charge = await tx.payable_transactions.findFirst({ where: { sourceType: "PURCHASE", sourceId: id, entryType: "CHARGE" } });
      const reversal = await tx.payable_transactions.create({
        data: {
          supplierId: document.supplierId, sourceType: "PURCHASE_CANCEL", sourceId: id, sourceCode: document.code,
          entryType: "REVERSAL", amount: money(-Number(document.totalAmount || 0)), occurredAt: cancelledAt,
          reversalOfId: charge?.id, createdBy: userId,
        },
      });
      await tx.purchase_document_links_v1.create({ data: { purchaseDocumentId: id, linkType: "PAYABLE_REVERSAL", linkedId: reversal.id, linkedCode: document.code } });

      const paymentEntries = await tx.payable_transactions.findMany({ where: { sourceId: id, entryType: "PAYMENT" } });
      for (const entry of paymentEntries) await tx.payable_transactions.create({ data: {
        supplierId: document.supplierId, sourceType: "PURCHASE_PAYMENT_CANCEL", sourceId: id, sourceCode: document.code,
        entryType: "PAYMENT_REVERSAL", amount: money(Math.abs(Number(entry.amount))), paymentDocumentId: entry.paymentDocumentId,
        occurredAt: cancelledAt, reversalOfId: entry.id, createdBy: userId,
      } });

      if (Number(document.paidAmount || 0) > 0) {
        const voucherLink = originalLinks.find(link => link.linkType === "PAYMENT_VOUCHER");
        if (voucherLink) await tx.payment_vouchers.update({ where: { id: voucherLink.linkedId }, data: { status: "CANCELLED" } });
        const reversalVoucherCode = `H-PC-${document.code}`;
        const reversalVoucher = await tx.payment_vouchers.create({
          data: {
            code: reversalVoucherCode, supplierId: document.supplierId, voucherDate: dateAtNoon(now.slice(0, 10)),
            method: document.paymentMethod || "CASH", amount: money(Number(document.paidAmount)), direction: "REVERSAL",
            note: `Hoàn nguyên thanh toán ${document.code}`, status: "POSTED", createdBy: userId,
          },
        });
        await tx.payment_voucher_allocations.create({
          data: { paymentVoucherId: reversalVoucher.id, purchaseDocumentId: id, amount: money(-Number(document.paidAmount)) },
        });
        await tx.supplier_payments.create({
          data: {
            supplierId: document.supplierId, purchaseDocumentId: id, paymentDate: now.slice(0, 10),
            amount: -Number(document.paidAmount), method: document.paymentMethod || "CASH",
            note: `Hoàn nguyên thanh toán v1 ${document.code}`, createdBy: userId, createdAt: now,
          },
        });
        await tx.purchase_document_links_v1.create({ data: { purchaseDocumentId: id, linkType: "PAYMENT_REVERSAL", linkedId: reversalVoucher.id, linkedCode: reversalVoucherCode } });
      }

      const updated = await tx.purchase_documents.update({
        where: { id },
        data: {
          documentStatus: "CANCELLED", cancelledAt, cancelledBy: userId, cancelReason: input.reason,
          paymentStatus: "UNPAID", paidAmount: 0, version: { increment: 1 }, updatedAt: now,
        }, include: purchaseInclude,
      });
      await tx.audit_logs.create({ data: { action: "Hủy mua hàng v1", details: `${document.code}: ${input.reason}`, userId, userName: String(userId), createdAt: now } });
      return mapPurchaseDocument(updated);
    }, { timeout: 30_000 });
  },
};