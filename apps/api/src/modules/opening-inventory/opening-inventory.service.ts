import { Prisma } from "@challenge/database";
import { prisma } from "@challenge/database";
import type { OpeningInventoryCancelInput, OpeningInventoryDraftInput, OpeningInventoryListQuery, OpeningInventoryUpdateInput } from "@challenge/contracts";
import { HttpError } from "../../common/http-error";
import { openingInventoryRepository } from "./opening-inventory.repository";
import { inventoryRepository } from "../inventory/inventory.repository";
import { nextDocumentCode } from "../../common/document-code";

const decimal = (v: number) => new Prisma.Decimal(v.toFixed(4));
const money = (v: number) => new Prisma.Decimal(v.toFixed(2));
const nowIso = () => new Date().toISOString();
const dateAtNoon = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00.000Z`);

const docInclude = {
  warehouse: { select: { id: true, name: true } },
  lines: true,
} as const;

const serializeDocument = (document: any) => JSON.parse(JSON.stringify(document, (_key, value) =>
  typeof value === "bigint" ? Number(value) : value,
));

async function validateInputItems(lines: OpeningInventoryDraftInput["lines"]) {
  const packagingIds = [...new Set(lines.map(l => l.packagingId))];
  const validIds = await openingInventoryRepository.packagingIds(packagingIds);
  lines.forEach((line, i) => {
    if (!validIds.has(line.packagingId)) throw new HttpError(422, "ITEM_NOT_FOUND", `Hàng hóa dòng ${i + 1} không tồn tại`);
  });
}

async function lockDocument(tx: any, id: number) {
  const rows = await tx.$queryRawUnsafe("SELECT id,status,version,warehouseId,code FROM opening_inventory_documents WHERE id=? FOR UPDATE", id) as any[];
  if (!rows[0]) throw new HttpError(404, "OPENING_INVENTORY_NOT_FOUND", "Không tìm thấy phiếu tồn đầu kỳ");
  return rows[0];
}

const lineCreateData = (line: OpeningInventoryDraftInput["lines"][number]) => ({
  packagingId: line.packagingId,
  quantity: decimal(line.quantity),
  unitCost: decimal(line.unitCost ?? 0),
  totalValue: money(line.quantity * (line.unitCost ?? 0)),
  batchNumber: line.batchNumber || null,
  expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
  note: line.note || null,
});

export const openingInventoryService = {
  async list(query: OpeningInventoryListQuery) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.search) where.code = { contains: query.search };
    const [rows, total] = await Promise.all([
      openingInventoryRepository.list(where, (query.page - 1) * query.limit, query.limit),
      openingInventoryRepository.count(where),
    ]);
    return { data: serializeDocument(rows), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  },

  async get(id: number) {
    const row = await openingInventoryRepository.findById(id);
    if (!row) throw new HttpError(404, "OPENING_INVENTORY_NOT_FOUND", "Không tìm thấy phiếu tồn đầu kỳ");
    return serializeDocument(row);
  },

  async create(input: OpeningInventoryDraftInput, userId: number) {
    const warehouse = await openingInventoryRepository.warehouseExists(input.warehouseId);
    if (!warehouse) throw new HttpError(422, "WAREHOUSE_NOT_FOUND", "Kho không tồn tại");
    await validateInputItems(input.lines);
    const now = new Date();
    const generatedCode = await nextDocumentCode("opening_inventory");
    const created = await prisma.opening_inventory_documents.create({
      data: {
        code: generatedCode,
        documentDate: dateAtNoon(input.documentDate),
        warehouseId: input.warehouseId,
        status: "DRAFT",
        note: input.note || null,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        lines: { create: input.lines.map(lineCreateData) },
      },
    });
    return serializeDocument(await openingInventoryRepository.findById(Number(created.id)));
  },

  async update(id: number, input: OpeningInventoryUpdateInput, userId: number) {
    const warehouse = await openingInventoryRepository.warehouseExists(input.warehouseId);
    if (!warehouse) throw new HttpError(422, "WAREHOUSE_NOT_FOUND", "Kho không tồn tại");
    await validateInputItems(input.lines);
    await prisma.$transaction(async tx => {
      const current = await lockDocument(tx, id);
      if (current.status === "CANCELLED") throw new HttpError(409, "OPENING_INVENTORY_NOT_EDITABLE", "Phiếu đã hủy, không thể sửa");
      if (Number(current.version) !== input.version) throw new HttpError(409, "VERSION_CONFLICT", "Phiếu đã được người khác cập nhật");
      const newDate = dateAtNoon(input.documentDate);
      const now = new Date();

      if (current.status === "DRAFT") {
        await tx.opening_inventory_lines.deleteMany({ where: { documentId: id } });
        await tx.opening_inventory_documents.update({
          where: { id },
          data: {
            documentDate: newDate,
            warehouseId: input.warehouseId,
            note: input.note || null,
            version: { increment: 1 },
            updatedAt: now,
            lines: { create: input.lines.map(lineCreateData) },
          },
        });
        return;
      }

      // POSTED: chỉ cho sửa ngày chứng từ + ghi chú, kho và hàng hóa đã khóa
      if (Number(current.warehouseId) !== Number(input.warehouseId))
        throw new HttpError(409, "OPENING_INVENTORY_WAREHOUSE_LOCKED", "Không thể đổi kho của phiếu đã ghi sổ");
      await tx.opening_inventory_documents.update({
        where: { id },
        data: {
          documentDate: newDate,
          note: input.note || null,
          version: { increment: 1 },
          updatedAt: now,
        },
      });
      // Cập nhật lại ngày vào sổ kho để tính tồn theo ngày
      await tx.inventory_ledger.updateMany({
        where: { sourceType: "OPENING", sourceId: id },
        data: { occurredAt: newDate },
      });
      // Đồng bộ ngày với phiếu nhập kho tự động đã sinh khi ghi sổ
      const dateStr = input.documentDate.slice(0, 10);
      const linkedDoc = await tx.inventorytransactions.findFirst({
        where: { sourceModule: "OPENING_INVENTORY", note: { contains: String(current.code) } },
        select: { id: true },
      });
      if (linkedDoc) {
        await tx.inventorytransactions.update({
          where: { id: linkedDoc.id },
          data: {
            transaction_date: dateStr,
            entry_date: dateStr,
            note: `Tự động từ tồn đầu kỳ ${current.code}${input.note ? `: ${input.note}` : ""}`,
            updatedAt: now.toISOString(),
          },
        });
      }
      await tx.audit_logs.create({
        data: { action: "Sửa ngày tồn đầu kỳ", details: `${current.code} -> ${dateStr}`, userId, userName: String(userId), createdAt: now.toISOString() },
      });
    });
    return serializeDocument(await openingInventoryRepository.findById(id));
  },

  async post(id: number, version: number, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockDocument(tx, id);
      if (current.status !== "DRAFT") throw new HttpError(409, "OPENING_INVENTORY_NOT_POSTABLE", "Chỉ được ghi sổ phiếu ở trạng thái Nháp");
      if (Number(current.version) !== version) throw new HttpError(409, "VERSION_CONFLICT", "Phiếu đã được người khác cập nhật");
      const doc = await openingInventoryRepository.findById(id);
      if (!doc) throw new HttpError(404, "OPENING_INVENTORY_NOT_FOUND", "Không tìm thấy phiếu tồn đầu kỳ");
      const now = new Date();
      const nowStr = nowIso();
      const occurredAt = doc.documentDate instanceof Date ? doc.documentDate : new Date(doc.documentDate);

      for (const line of doc.lines) {
        const qty = Number(line.quantity);
        const cost = Number(line.unitCost);
        const value = qty * cost;

        await tx.productwarehouses.upsert({
          where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId: doc.warehouseId } },
          create: { packagingId: line.packagingId, warehouseId: doc.warehouseId, stock_quantity: qty, updatedAt: nowStr },
          update: { stock_quantity: { increment: qty }, updatedAt: nowStr },
        });

        await tx.inventory_ledger.create({
          data: {
            sourceType: "OPENING",
            sourceId: id,
            sourceLineId: Number(line.id),
            documentCode: doc.code,
            direction: "IN",
            packagingId: line.packagingId,
            warehouseId: doc.warehouseId,
            quantity: decimal(qty),
            unitCost: decimal(cost),
            totalValue: money(value),
            occurredAt,
            createdBy: userId,
          },
        });
      }

      // Create corresponding inventory import document
      const docDateStr = doc.documentDate instanceof Date ? doc.documentDate.toISOString().slice(0, 10) : doc.documentDate;
      const invCode = await nextDocumentCode("inventory_import");
      const inventoryDoc = await tx.inventorytransactions.create({
        data: {
          code: invCode,
          type: "IMPORT",
          transaction_date: docDateStr,
          entry_date: docDateStr,
          warehouseId: doc.warehouseId,
          note: `Tự động từ tồn đầu kỳ ${doc.code}${doc.note ? `: ${doc.note}` : ""}`,
          reason: "OPENING_INVENTORY",
          recipient: "Hệ thống",
          createdBy: userId,
          createdAt: nowStr,
          updatedAt: nowStr,
          documentStatus: "POSTED",
          sourceModule: "OPENING_INVENTORY",
          inventorytransactiondetails: {
            create: doc.lines.map(line => ({
              packagingId: line.packagingId,
              quantity: Number(line.quantity),
              unitCost: Number(line.unitCost),
              totalValue: Number(line.quantity) * Number(line.unitCost),
              note: "",
              createdAt: nowStr,
              updatedAt: nowStr,
            })),
          },
        },
        include: { inventorytransactiondetails: true },
      });

      await tx.audit_logs.create({
        data: { action: "Ghi sổ tồn đầu kỳ", details: `${doc.code} -> ${invCode}`, userId, userName: String(userId), createdAt: nowStr },
      });

      await tx.opening_inventory_documents.update({
        where: { id },
        data: { status: "POSTED", postedAt: now, postedBy: userId, version: { increment: 1 }, updatedAt: nowStr },
      });
    }, { timeout: 30_000 });
    return serializeDocument(await openingInventoryRepository.findById(id));
  },

  async cancel(id: number, input: OpeningInventoryCancelInput, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockDocument(tx, id);
      if (current.status !== "POSTED") throw new HttpError(409, "OPENING_INVENTORY_NOT_CANCELLABLE", "Chỉ được hủy phiếu đã ghi sổ");
      if (Number(current.version) !== input.version) throw new HttpError(409, "VERSION_CONFLICT", "Phiếu đã được người khác cập nhật");
      const doc = await openingInventoryRepository.findById(id);
      if (!doc) throw new HttpError(404, "OPENING_INVENTORY_NOT_FOUND", "Không tìm thấy phiếu tồn đầu kỳ");
      const now = new Date();
      const nowStr = nowIso();

      for (const line of doc.lines) {
        const qty = Number(line.quantity);
        await tx.productwarehouses.update({
          where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId: doc.warehouseId } },
          data: { stock_quantity: { decrement: qty }, updatedAt: nowStr },
        });

        const origEntries = await tx.inventory_ledger.findMany({
          where: { sourceType: "OPENING", sourceId: id, sourceLineId: Number(line.id) },
        });
        for (const orig of origEntries) {
          await tx.inventory_ledger.create({
            data: {
              sourceType: "OPENING_CANCEL",
              sourceId: id,
              sourceLineId: Number(line.id),
              documentCode: doc.code,
              direction: "OUT",
              packagingId: line.packagingId,
              warehouseId: doc.warehouseId,
              quantity: decimal(qty),
              unitCost: orig.unitCost,
              totalValue: money(-qty * Number(orig.unitCost)),
              reversalOfId: orig.id,
              occurredAt: now,
              createdBy: userId,
            },
          });
        }
      }

      await tx.audit_logs.create({
        data: { action: "Hủy phiếu tồn đầu kỳ", details: `${doc.code}: ${input.reason}`, userId, userName: String(userId), createdAt: nowStr },
      });

      await tx.opening_inventory_documents.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancelledBy: userId,
          cancelReason: input.reason,
          version: { increment: 1 },
          updatedAt: nowStr,
        },
      });
    }, { timeout: 30_000 });
    return serializeDocument(await openingInventoryRepository.findById(id));
  },
};
