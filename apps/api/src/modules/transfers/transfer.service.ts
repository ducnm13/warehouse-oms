import type { TransferCancelInput, TransferDraftInput, TransferUpdateInput } from "@challenge/contracts";
import { Prisma } from "@challenge/database";
import { HttpError } from "../../common/http-error";
import { mapTransfer } from "./transfer.mapper";
import { prisma, transferInclude, transferRepository } from "./transfer.repository";

const decimal = (value: number) => new Prisma.Decimal(value.toFixed(4));
const money = (value: number) => new Prisma.Decimal(value.toFixed(2));
const nowIso = () => new Date().toISOString();
const transferCode = (date: string) => `CKV1-${date.replaceAll("-", "")}-${Date.now().toString().slice(-6)}`;

async function validateMaster(input: TransferDraftInput) {
  const packagingIds = input.details.map(line => line.packagingId);
  const [warehouses, packagings] = await Promise.all([
    transferRepository.warehouses([input.fromWarehouseId, input.toWarehouseId]),
    transferRepository.packagingIds(packagingIds),
  ]);
  if (!warehouses.has(input.fromWarehouseId) || !warehouses.has(input.toWarehouseId)) throw new HttpError(422, "WAREHOUSE_NOT_FOUND", "Kho nguồn hoặc kho đích không tồn tại");
  packagingIds.forEach((id, index) => { if (!packagings.has(id)) throw new HttpError(422, "ITEM_NOT_FOUND", `Hàng hóa dòng ${index + 1} không tồn tại`); });
}

async function lockTransfer(tx: any, id: number) {
  const rows = await tx.$queryRawUnsafe("SELECT id,status,version,sourceModule FROM warehouse_transfers WHERE id=? FOR UPDATE", id) as any[];
  if (!rows[0] || rows[0].sourceModule !== "TRANSFER_V1") throw new HttpError(404, "TRANSFER_NOT_FOUND", "Không tìm thấy phiếu chuyển kho V1");
  return rows[0];
}

const assertVersion = (current: any, version: number) => {
  if (Number(current.version) !== version) throw new HttpError(409, "VERSION_CONFLICT", "Dữ liệu đã được người khác cập nhật");
};

async function lockBalance(tx: any, packagingId: number, warehouseId: number) {
  await tx.$executeRawUnsafe(
    `INSERT INTO productwarehouses (packagingId,warehouseId,stock_quantity,updatedAt)
     VALUES (?,?,0,?) ON DUPLICATE KEY UPDATE updatedAt=updatedAt`, packagingId, warehouseId, nowIso(),
  );
  const rows = await tx.$queryRawUnsafe(
    "SELECT stock_quantity FROM productwarehouses WHERE packagingId=? AND warehouseId=? FOR UPDATE", packagingId, warehouseId,
  ) as any[];
  return Number(rows[0]?.stock_quantity || 0);
}

async function ensureOpening(tx: any, packagingId: number, warehouseId: number, balance: number) {
  const netRows = await tx.$queryRawUnsafe(
    `SELECT COALESCE(SUM(CASE WHEN direction='IN' THEN quantity ELSE -quantity END),0) net
     FROM inventory_ledger WHERE packagingId=? AND warehouseId=?`, packagingId, warehouseId,
  ) as any[];
  await tx.inventory_ledger_opening_balances.upsert({
    where: { packagingId_warehouseId: { packagingId, warehouseId } },
    create: { packagingId, warehouseId, quantity: decimal(balance - Number(netRows[0]?.net || 0)) },
    update: {},
  });
}

async function averageCost(tx: any, packagingId: number, warehouseId: number) {
  const rows = await tx.$queryRawUnsafe(
    `SELECT COALESCE(SUM(CASE WHEN direction='IN' THEN quantity ELSE -quantity END),0) quantity,
      COALESCE(SUM(CASE WHEN direction='IN' THEN totalValue ELSE -totalValue END),0) totalValue
     FROM inventory_ledger WHERE packagingId=? AND warehouseId=?`, packagingId, warehouseId,
  ) as any[];
  const quantity = Number(rows[0]?.quantity || 0), value = Number(rows[0]?.totalValue || 0);
  return quantity > 0 && value > 0 ? value / quantity : 0;
}

async function createInventoryDocument(tx: any, data: {
  code: string; type: "IMPORT" | "EXPORT"; date: string; warehouseId: number; note: string;
  reason: string; userId: number; sourceModule: string;
}) {
  const now = nowIso(), occurredAt = new Date();
  return tx.inventorytransactions.create({ data: {
    code: data.code, type: data.type, transaction_date: data.date,
    entry_date: data.type === "IMPORT" ? data.date : null,
    exit_date: data.type === "EXPORT" ? data.date : null,
    warehouseId: data.warehouseId, note: data.note, reason: data.reason,
    createdBy: data.userId, createdAt: now, updatedAt: now,
    documentStatus: "POSTED", postedAt: occurredAt, postedBy: data.userId, sourceModule: data.sourceModule,
  } });
}

export const transferService = {
  async list(query: any) {
    const where: Prisma.warehouse_transfersWhereInput = {
      sourceModule: "TRANSFER_V1",
      ...(query.status ? { status: query.status } : {}),
      ...(query.fromWarehouseId ? { fromWarehouseId: query.fromWarehouseId } : {}),
      ...(query.toWarehouseId ? { toWarehouseId: query.toWarehouseId } : {}),
      ...(query.search ? { OR: [
        { code: { contains: query.search } }, { note: { contains: query.search } },
        { warehouses_warehouse_transfers_fromWarehouseIdTowarehouses: { name: { contains: query.search } } },
        { warehouses_warehouse_transfers_toWarehouseIdTowarehouses: { name: { contains: query.search } } },
      ] } : {}),
    };
    const [rows, total] = await Promise.all([
      transferRepository.list(where, (query.page - 1) * query.limit, query.limit),
      transferRepository.count(where),
    ]);
    return { data: rows.map(mapTransfer), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  },

  async get(id: number) {
    const row = await transferRepository.findById(id);
    if (!row || row.sourceModule !== "TRANSFER_V1") throw new HttpError(404, "TRANSFER_NOT_FOUND", "Không tìm thấy phiếu chuyển kho V1");
    return mapTransfer(row);
  },

  async create(input: TransferDraftInput, userId: number) {
    await validateMaster(input);
    return prisma.$transaction(async tx => {
      const now = nowIso();
      const row = await tx.warehouse_transfers.create({ data: {
        code: transferCode(input.transferDate), transferDate: input.transferDate,
        fromWarehouseId: input.fromWarehouseId, toWarehouseId: input.toWarehouseId,
        status: "DRAFT", note: input.note, sourceModule: "TRANSFER_V1",
        createdBy: userId, createdAt: now,
        warehouse_transfer_details: { create: input.details.map(line => ({ packagingId: line.packagingId, quantity: line.quantity, note: line.note })) },
      }, include: transferInclude });
      await tx.audit_logs.create({ data: { action: "Tạo chuyển kho v1", details: row.code, userId, userName: String(userId), createdAt: now } });
      return mapTransfer(row);
    });
  },

  async update(id: number, input: TransferUpdateInput, userId: number) {
    await validateMaster(input);
    return prisma.$transaction(async tx => {
      const current = await lockTransfer(tx, id); assertVersion(current, input.version);
      if (current.status !== "DRAFT") throw new HttpError(409, "INVALID_STATUS", "Chỉ được sửa phiếu chuyển kho đang nháp");
      await tx.warehouse_transfer_details.deleteMany({ where: { transferId: id } });
      const row = await tx.warehouse_transfers.update({ where: { id }, data: {
        transferDate: input.transferDate, fromWarehouseId: input.fromWarehouseId, toWarehouseId: input.toWarehouseId,
        note: input.note, version: { increment: 1 },
        warehouse_transfer_details: { create: input.details.map(line => ({ packagingId: line.packagingId, quantity: line.quantity, note: line.note })) },
      }, include: transferInclude });
      await tx.audit_logs.create({ data: { action: "Cập nhật chuyển kho v1", details: row.code, userId, userName: String(userId), createdAt: nowIso() } });
      return mapTransfer(row);
    });
  },

  async ship(id: number, version: number, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockTransfer(tx, id); assertVersion(current, version);
      if (current.status !== "DRAFT") throw new HttpError(409, "INVALID_STATUS", "Chỉ được xuất hàng cho phiếu chuyển kho đang nháp");
      const document = await tx.warehouse_transfers.findUnique({ where: { id }, include: transferInclude });
      if (!document) throw new HttpError(404, "TRANSFER_NOT_FOUND", "Không tìm thấy phiếu chuyển kho");
      const exportCode = `PX-${document.code}`;
      const header = await createInventoryDocument(tx, {
        code: exportCode, type: "EXPORT", date: document.transferDate, warehouseId: document.fromWarehouseId,
        note: `Xuất chuyển kho ${document.code}`, reason: "Giao hàng chuyển kho v1", userId, sourceModule: "TRANSFER_SHIPMENT_V1",
      });
      const occurredAt = new Date(), now = nowIso();
      for (const line of document.warehouse_transfer_details) {
        const quantity = Number(line.quantity), balance = await lockBalance(tx, line.packagingId, document.fromWarehouseId);
        await ensureOpening(tx, line.packagingId, document.fromWarehouseId, balance);
        if (balance < quantity) throw new HttpError(409, "NEGATIVE_STOCK", `Không đủ tồn kho nguồn cho ${line.productpackagings?.sku || line.packagingId}`);
        const unitCost = await averageCost(tx, line.packagingId, document.fromWarehouseId);
        const inventoryLine = await tx.inventorytransactiondetails.create({ data: {
          transactionId: header.id, packagingId: line.packagingId, quantity,
          unitCost: decimal(unitCost), totalValue: money(quantity * unitCost), note: document.code, createdAt: now, updatedAt: now,
        } });
        await tx.warehouse_transfer_details.update({ where: { id: line.id }, data: { unitCost: decimal(unitCost), totalValue: money(quantity * unitCost) } });
        await tx.productwarehouses.update({ where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId: document.fromWarehouseId } }, data: { stock_quantity: { decrement: quantity }, updatedAt: now } });
        await tx.inventory_ledger.create({ data: {
          sourceType: "TRANSFER_SHIPMENT", sourceId: id, sourceLineId: line.id, documentCode: document.code,
          direction: "OUT", packagingId: line.packagingId, warehouseId: document.fromWarehouseId,
          quantity: decimal(quantity), unitCost: decimal(unitCost), totalValue: money(quantity * unitCost), occurredAt, createdBy: userId,
        } });
        void inventoryLine;
      }
      await tx.warehouse_transfer_document_links_v1.create({ data: { transferId: id, linkType: "SHIPMENT_EXPORT", linkedId: BigInt(header.id), linkedCode: exportCode } });
      const row = await tx.warehouse_transfers.update({ where: { id }, data: {
        status: "IN_TRANSIT", exportTransactionId: header.id, shippedAt: occurredAt, shippedBy: userId, version: { increment: 1 },
      }, include: transferInclude });
      await tx.audit_logs.create({ data: { action: "Xuất hàng chuyển kho v1", details: row.code, userId, userName: String(userId), createdAt: now } });
      return mapTransfer(row);
    }, { timeout: 30_000 });
  },

  async receive(id: number, version: number, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockTransfer(tx, id); assertVersion(current, version);
      if (current.status !== "IN_TRANSIT") throw new HttpError(409, "INVALID_STATUS", "Chỉ được nhận phiếu đang vận chuyển");
      const document = await tx.warehouse_transfers.findUnique({ where: { id }, include: transferInclude });
      if (!document) throw new HttpError(404, "TRANSFER_NOT_FOUND", "Không tìm thấy phiếu chuyển kho");
      const importCode = `PN-${document.code}`;
      const header = await createInventoryDocument(tx, {
        code: importCode, type: "IMPORT", date: nowIso().slice(0, 10), warehouseId: document.toWarehouseId,
        note: `Nhận chuyển kho ${document.code}`, reason: "Nhận hàng chuyển kho v1", userId, sourceModule: "TRANSFER_RECEIPT_V1",
      });
      const occurredAt = new Date(), now = nowIso();
      for (const line of document.warehouse_transfer_details) {
        const quantity = Number(line.quantity), unitCost = Number(line.unitCost);
        const balance = await lockBalance(tx, line.packagingId, document.toWarehouseId);
        await ensureOpening(tx, line.packagingId, document.toWarehouseId, balance);
        await tx.inventorytransactiondetails.create({ data: {
          transactionId: header.id, packagingId: line.packagingId, quantity,
          unitCost: line.unitCost, totalValue: line.totalValue, note: document.code, createdAt: now, updatedAt: now,
        } });
        await tx.productwarehouses.update({ where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId: document.toWarehouseId } }, data: { stock_quantity: { increment: quantity }, updatedAt: now } });
        await tx.inventory_ledger.create({ data: {
          sourceType: "TRANSFER_RECEIPT", sourceId: id, sourceLineId: line.id, documentCode: document.code,
          direction: "IN", packagingId: line.packagingId, warehouseId: document.toWarehouseId,
          quantity: decimal(quantity), unitCost: decimal(unitCost), totalValue: money(quantity * unitCost), occurredAt, createdBy: userId,
        } });
      }
      await tx.warehouse_transfer_document_links_v1.create({ data: { transferId: id, linkType: "RECEIPT_IMPORT", linkedId: BigInt(header.id), linkedCode: importCode } });
      const row = await tx.warehouse_transfers.update({ where: { id }, data: {
        status: "RECEIVED", importTransactionId: header.id, receivedAt: occurredAt, receivedBy: userId, version: { increment: 1 },
      }, include: transferInclude });
      await tx.audit_logs.create({ data: { action: "Nhận hàng chuyển kho v1", details: row.code, userId, userName: String(userId), createdAt: now } });
      return mapTransfer(row);
    }, { timeout: 30_000 });
  },

  async cancel(id: number, input: TransferCancelInput, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockTransfer(tx, id); assertVersion(current, input.version);
      if (!(["DRAFT", "IN_TRANSIT"] as string[]).includes(current.status)) throw new HttpError(409, "INVALID_STATUS", "Chỉ được hủy phiếu nháp hoặc đang vận chuyển");
      const document = await tx.warehouse_transfers.findUnique({ where: { id }, include: transferInclude });
      if (!document) throw new HttpError(404, "TRANSFER_NOT_FOUND", "Không tìm thấy phiếu chuyển kho");
      const occurredAt = new Date(), now = nowIso();
      let cancellationTransactionId: number | undefined;
      if (current.status === "IN_TRANSIT") {
        const reversalCode = `H-${document.code}`;
        const header = await createInventoryDocument(tx, {
          code: reversalCode, type: "IMPORT", date: now.slice(0, 10), warehouseId: document.fromWarehouseId,
          note: `Hoàn kho do hủy ${document.code}: ${input.reason}`, reason: "Hủy chuyển kho v1", userId, sourceModule: "TRANSFER_CANCEL_V1",
        });
        cancellationTransactionId = header.id;
        const originals = await tx.inventory_ledger.findMany({ where: { sourceType: "TRANSFER_SHIPMENT", sourceId: id } });
        if (originals.length !== document.warehouse_transfer_details.length) throw new HttpError(409, "LEDGER_NOT_FOUND", "Không đủ ledger giao hàng để hoàn kho");
        for (const line of document.warehouse_transfer_details) {
          const quantity = Number(line.quantity), balance = await lockBalance(tx, line.packagingId, document.fromWarehouseId);
          const inventoryLine = await tx.inventorytransactiondetails.create({ data: {
            transactionId: header.id, packagingId: line.packagingId, quantity,
            unitCost: line.unitCost, totalValue: line.totalValue, note: input.reason, createdAt: now, updatedAt: now,
          } });
          await tx.productwarehouses.update({ where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId: document.fromWarehouseId } }, data: { stock_quantity: { increment: quantity }, updatedAt: now } });
          const original = originals.find(entry => entry.sourceLineId === line.id);
          await tx.inventory_ledger.create({ data: {
            sourceType: "TRANSFER_CANCEL", sourceId: id, sourceLineId: inventoryLine.id, documentCode: document.code,
            direction: "IN", packagingId: line.packagingId, warehouseId: document.fromWarehouseId,
            quantity: decimal(quantity), unitCost: line.unitCost, totalValue: line.totalValue,
            reversalOfId: original?.id, occurredAt, createdBy: userId,
          } });
          void balance;
        }
        await tx.warehouse_transfer_document_links_v1.create({ data: { transferId: id, linkType: "CANCELLATION_IMPORT", linkedId: BigInt(header.id), linkedCode: reversalCode } });
      }
      const row = await tx.warehouse_transfers.update({ where: { id }, data: {
        status: "CANCELLED", cancelledAt: occurredAt, cancelledBy: userId, cancelReason: input.reason,
        cancellationTransactionId, version: { increment: 1 },
      }, include: transferInclude });
      await tx.audit_logs.create({ data: { action: "Hủy chuyển kho v1", details: `${row.code}: ${input.reason}`, userId, userName: String(userId), createdAt: now } });
      return mapTransfer(row);
    }, { timeout: 30_000 });
  },
};