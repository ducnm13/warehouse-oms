import { Prisma } from "@challenge/database";
import { prisma } from "@challenge/database";
import type { OpeningInventoryCancelInput, OpeningInventoryDraftInput, OpeningInventoryListQuery, OpeningInventoryUpdateInput } from "@challenge/contracts";
import { HttpError } from "../../common/http-error";
import { openingInventoryRepository } from "./opening-inventory.repository";

const decimal = (v: number) => new Prisma.Decimal(v.toFixed(4));
const money = (v: number) => new Prisma.Decimal(v.toFixed(2));

async function validateInputItems(lines: OpeningInventoryDraftInput["lines"]) {
  const packagingIds = [...new Set(lines.map(l => l.packagingId))];
  const validIds = await openingInventoryRepository.packagingIds(packagingIds);
  lines.forEach((line, i) => {
    if (!validIds.has(line.packagingId)) throw new HttpError(422, "ITEM_NOT_FOUND", `Hàng hóa dòng ${i + 1} không tồn tại`);
  });
}

async function lockDocument(tx: any, id: number) {
  const rows = await tx.$queryRawUnsafe("SELECT id,status,version FROM opening_inventory_documents WHERE id=? FOR UPDATE", id) as any[];
  if (!rows[0]) throw new HttpError(404, "OPENING_INVENTORY_NOT_FOUND", "Không tìm thấy phiếu tồn đầu kỳ");
  return rows[0];
}

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
    return { data: rows, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  },

  async get(id: number) {
    const row = await openingInventoryRepository.findById(id);
    if (!row) throw new HttpError(404, "OPENING_INVENTORY_NOT_FOUND", "Không tìm thấy phiếu tồn đầu kỳ");
    return row;
  },

  async create(input: OpeningInventoryDraftInput, userId: number) {
    const warehouse = await openingInventoryRepository.warehouseExists(input.warehouseId);
    if (!warehouse) throw new HttpError(422, "WAREHOUSE_NOT_FOUND", "Kho không tồn tại");
    await validateInputItems(input.lines);
    const code = `TDK-${input.documentDate.replaceAll("-", "")}-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    const row = await prisma.opening_inventory_documents.create({
      data: {
        code,
        documentDate: new Date(input.documentDate),
        warehouseId: input.warehouseId,
        status: "DRAFT",
        note: input.note || null,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        opening_inventory_lines: {
          create: input.lines.map(line => ({
            packagingId: line.packagingId,
            quantity: decimal(line.quantity),
            unitCost: decimal(line.unitCost ?? 0),
            totalValue: money(line.quantity * (line.unitCost ?? 0)),
            batchNumber: line.batchNumber || null,
            expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
            note: line.note || null,
          })),
        },
      },
      include: { warehouses: { select: { id: true, name: true } }, opening_inventory_lines: true },
    });
    return row;
  },

  async update(id: number, input: OpeningInventoryUpdateInput, userId: number) {
    const warehouse = await openingInventoryRepository.warehouseExists(input.warehouseId);
    if (!warehouse) throw new HttpError(422, "WAREHOUSE_NOT_FOUND", "Kho không tồn tại");
    await validateInputItems(input.lines);
    return prisma.$transaction(async tx => {
      const current = await lockDocument(tx, id);
      if (current.status !== "DRAFT") throw new HttpError(409, "OPENING_INVENTORY_NOT_EDITABLE", "Chỉ được sửa phiếu ở trạng thái Nháp");
      if (Number(current.version) !== input.version) throw new HttpError(409, "VERSION_CONFLICT", "Phiếu đã được người khác cập nhật");
      const now = new Date();
      await tx.opening_inventory_lines.deleteMany({ where: { documentId: id } });
      return tx.opening_inventory_documents.update({
        where: { id },
        data: {
          documentDate: new Date(input.documentDate),
          warehouseId: input.warehouseId,
          note: input.note || null,
          version: { increment: 1 },
          updatedAt: now,
          updatedBy: userId,
          opening_inventory_lines: {
            create: input.lines.map(line => ({
              packagingId: line.packagingId,
              quantity: decimal(line.quantity),
              unitCost: decimal(line.unitCost ?? 0),
              totalValue: money(line.quantity * (line.unitCost ?? 0)),
              batchNumber: line.batchNumber || null,
              expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
              note: line.note || null,
            })),
          },
        },
        include: { warehouses: { select: { id: true, name: true } }, opening_inventory_lines: true },
      });
    });
  },

  async post(id: number, version: number, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockDocument(tx, id);
      if (current.status !== "DRAFT") throw new HttpError(409, "OPENING_INVENTORY_NOT_POSTABLE", "Chỉ được ghi sổ phiếu ở trạng thái Nháp");
      if (Number(current.version) !== version) throw new HttpError(409, "VERSION_CONFLICT", "Phiếu đã được người khác cập nhật");
      const doc = await openingInventoryRepository.findById(id);
      if (!doc) throw new HttpError(404, "OPENING_INVENTORY_NOT_FOUND", "Không tìm thấy phiếu tồn đầu kỳ");
      const now = new Date();
      const postedAt = now;

      for (const line of doc.opening_inventory_lines) {
        const qty = Number(line.quantity);
        const cost = Number(line.unitCost);
        const value = qty * cost;

        // Upsert tồn kho
        await tx.productwarehouses.upsert({
          where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId: doc.warehouseId } },
          create: { packagingId: line.packagingId, warehouseId: doc.warehouseId, stock_quantity: qty, updatedAt: now.toISOString() },
          update: { stock_quantity: { increment: qty }, updatedAt: now.toISOString() },
        });

        // Ghi inventory ledger
        await tx.inventory_ledger.create({
          data: {
            sourceType: "OPENING",
            sourceId: id,
            sourceLineId: line.id,
            documentCode: doc.code,
            direction: "IN",
            packagingId: line.packagingId,
            warehouseId: doc.warehouseId,
            quantity: decimal(qty),
            unitCost: decimal(cost),
            totalValue: money(value),
            occurredAt: postedAt,
            createdBy: userId,
          },
        });
      }

      await tx.audit_logs.create({
        data: {
          action: "Ghi sổ tồn đầu kỳ",
          details: doc.code,
          userId,
          userName: String(userId),
          createdAt: now.toISOString(),
        },
      });

      return tx.opening_inventory_documents.update({
        where: { id },
        data: { status: "POSTED", postedAt: now, postedBy: userId, version: { increment: 1 }, updatedAt: now },
        include: { warehouses: { select: { id: true, name: true } }, opening_inventory_lines: true },
      });
    }, { timeout: 30_000 });
  },

  async cancel(id: number, input: OpeningInventoryCancelInput, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockDocument(tx, id);
      if (current.status !== "POSTED") throw new HttpError(409, "OPENING_INVENTORY_NOT_CANCELLABLE", "Chỉ được hủy phiếu đã ghi sổ");
      if (Number(current.version) !== input.version) throw new HttpError(409, "VERSION_CONFLICT", "Phiếu đã được người khác cập nhật");
      const doc = await openingInventoryRepository.findById(id);
      if (!doc) throw new HttpError(404, "OPENING_INVENTORY_NOT_FOUND", "Không tìm thấy phiếu tồn đầu kỳ");
      const now = new Date();

      for (const line of doc.opening_inventory_lines) {
        const qty = Number(line.quantity);
        await tx.productwarehouses.update({
          where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId: doc.warehouseId } },
          data: { stock_quantity: { decrement: qty }, updatedAt: now.toISOString() },
        });

        // Reversal ledger entry
        const origEntries = await tx.inventory_ledger.findMany({
          where: { sourceType: "OPENING", sourceId: id, sourceLineId: line.id },
        });
        for (const orig of origEntries) {
          await tx.inventory_ledger.create({
            data: {
              sourceType: "OPENING_CANCEL",
              sourceId: id,
              sourceLineId: line.id,
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
        data: {
          action: "Hủy phiếu tồn đầu kỳ",
          details: `${doc.code}: ${input.reason}`,
          userId,
          userName: String(userId),
          createdAt: now.toISOString(),
        },
      });

      return tx.opening_inventory_documents.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancelledBy: userId,
          cancelReason: input.reason,
          version: { increment: 1 },
          updatedAt: now,
        },
        include: { warehouses: { select: { id: true, name: true } }, opening_inventory_lines: true },
      });
    }, { timeout: 30_000 });
  },
};
