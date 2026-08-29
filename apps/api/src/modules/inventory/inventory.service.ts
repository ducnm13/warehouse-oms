import type { InventoryCancelInput, InventoryDraftInput, InventoryUpdateInput, StocktakeDraftInput, StocktakeUpdateInput } from "@challenge/contracts";
import { Prisma } from "@challenge/database";
import { HttpError } from "../../common/http-error";
import { mapInventoryDocument, mapStocktake } from "./inventory.mapper";
import { inventoryInclude, inventoryRepository, prisma, stocktakeInclude } from "./inventory.repository";

const decimal = (value: number) => new Prisma.Decimal(value.toFixed(4));
const money = (value: number) => new Prisma.Decimal(value.toFixed(2));
const nowIso = () => new Date().toISOString();
const code = (prefix: string, date: string) => `${prefix}-${date.replaceAll("-", "")}-${Date.now().toString().slice(-6)}`;

async function validateMaster(warehouseId: number, packagingIds: number[]) {
  const [warehouse, ids] = await Promise.all([inventoryRepository.warehouse(warehouseId), inventoryRepository.packagingIds(packagingIds)]);
  if (!warehouse) throw new HttpError(422, "WAREHOUSE_NOT_FOUND", "Kho không tồn tại");
  packagingIds.forEach((id, index) => { if (!ids.has(id)) throw new HttpError(422, "ITEM_NOT_FOUND", `Hàng hóa dòng ${index + 1} không tồn tại`); });
}

async function lockDocument(tx: any, id: number) {
  const rows = await tx.$queryRawUnsafe("SELECT id,documentStatus,version,sourceModule FROM inventorytransactions WHERE id=? FOR UPDATE", id) as any[];
  if (!rows[0]) throw new HttpError(404, "INVENTORY_NOT_FOUND", "Không tìm thấy chứng từ kho");
  return rows[0];
}
async function lockStocktake(tx: any, id: number) {
  const rows = await tx.$queryRawUnsafe("SELECT id,status,version FROM stocktakes WHERE id=? FOR UPDATE", id) as any[];
  if (!rows[0]) throw new HttpError(404, "STOCKTAKE_NOT_FOUND", "Không tìm thấy phiếu kiểm kê");
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
    create: { packagingId, warehouseId, quantity: decimal(balance - Number(netRows[0]?.net || 0)) }, update: {},
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

const detailData = (line: InventoryDraftInput["details"][number], now: string) => ({
  packagingId: line.packagingId, quantity: line.quantity, unitCost: money(line.unitCost),
  totalValue: money(line.quantity * line.unitCost), note: line.note || "", createdAt: now, updatedAt: now,
});

export const inventoryService = {
  async list(query: any) {
    const where: Prisma.inventorytransactionsWhereInput = {
      sourceModule: "MANUAL_V1",
      ...(query.status ? { documentStatus: query.status } : {}), ...(query.type ? { type: query.type } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.search ? { OR: [{ code: { contains: query.search } }, { note: { contains: query.search } }, { recipient: { contains: query.search } }] } : {}),
    };
    const [rows, total] = await Promise.all([inventoryRepository.list(where, (query.page - 1) * query.limit, query.limit), inventoryRepository.count(where)]);
    return { data: rows.map(mapInventoryDocument), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  },
  async get(id: number) {
    const row = await inventoryRepository.findById(id);
    if (!row || row.sourceModule !== "MANUAL_V1") throw new HttpError(404, "INVENTORY_NOT_FOUND", "Không tìm thấy chứng từ kho V1");
    return mapInventoryDocument(row);
  },
  async create(input: InventoryDraftInput, userId: number) {
    await validateMaster(input.warehouseId, input.details.map(line => line.packagingId));
    const now = nowIso();
    const row = await prisma.inventorytransactions.create({ data: {
      code: code(input.type === "IMPORT" ? "PNV1" : "PXV1", input.transactionDate), type: input.type,
      transaction_date: input.transactionDate, entry_date: input.type === "IMPORT" ? input.transactionDate : null,
      exit_date: input.type === "EXPORT" ? input.transactionDate : null, warehouseId: input.warehouseId,
      note: input.note, reason: input.reason, recipient: input.recipient, createdBy: userId,
      createdAt: now, updatedAt: now, documentStatus: "DRAFT", sourceModule: "MANUAL_V1",
      inventorytransactiondetails: { create: input.details.map(line => detailData(line, now)) },
    }, include: inventoryInclude });
    await prisma.audit_logs.create({ data: { action: "Tạo phiếu kho v1", details: row.code || String(row.id), userId, userName: String(userId), createdAt: now } });
    return mapInventoryDocument(row);
  },
  async update(id: number, input: InventoryUpdateInput, userId: number) {
    await validateMaster(input.warehouseId, input.details.map(line => line.packagingId));
    return prisma.$transaction(async tx => {
      const current = await lockDocument(tx, id); assertVersion(current, input.version);
      if (current.documentStatus !== "DRAFT" || current.sourceModule !== "MANUAL_V1") throw new HttpError(409, "INVALID_STATUS", "Chỉ được sửa chứng từ kho V1 đang nháp");
      const now = nowIso();
      await tx.inventorytransactiondetails.deleteMany({ where: { transactionId: id } });
      const row = await tx.inventorytransactions.update({ where: { id }, data: {
        type: input.type, transaction_date: input.transactionDate, entry_date: input.type === "IMPORT" ? input.transactionDate : null,
        exit_date: input.type === "EXPORT" ? input.transactionDate : null, warehouseId: input.warehouseId,
        note: input.note, reason: input.reason, recipient: input.recipient, updatedAt: now, version: { increment: 1 },
        inventorytransactiondetails: { create: input.details.map(line => detailData(line, now)) },
      }, include: inventoryInclude });
      await tx.audit_logs.create({ data: { action: "Cập nhật phiếu kho v1", details: row.code || String(id), userId, userName: String(userId), createdAt: now } });
      return mapInventoryDocument(row);
    });
  },
  async post(id: number, version: number, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockDocument(tx, id); assertVersion(current, version);
      if (current.documentStatus !== "DRAFT" || current.sourceModule !== "MANUAL_V1") throw new HttpError(409, "INVALID_STATUS", "Chứng từ không ở trạng thái nháp V1");
      const document = await tx.inventorytransactions.findUnique({ where: { id }, include: inventoryInclude });
      if (!document?.warehouseId) throw new HttpError(409, "MISSING_WAREHOUSE", "Chứng từ chưa có kho");
      const occurredAt = new Date(), now = nowIso();
      for (const line of document.inventorytransactiondetails) {
        if (!line.packagingId) throw new HttpError(409, "MISSING_ITEM", "Dòng chứng từ thiếu hàng hóa");
        const quantity = Number(line.quantity), balance = await lockBalance(tx, line.packagingId, document.warehouseId);
        await ensureOpening(tx, line.packagingId, document.warehouseId, balance);
        if (document.type === "EXPORT" && balance < quantity) throw new HttpError(409, "NEGATIVE_STOCK", `Không đủ tồn cho ${line.productpackagings?.sku || line.packagingId}`);
        const unitCost = document.type === "EXPORT" ? await averageCost(tx, line.packagingId, document.warehouseId) : Number(line.unitCost || 0);
        await tx.inventorytransactiondetails.update({ where: { id: line.id }, data: { unitCost: decimal(unitCost), totalValue: money(quantity * unitCost) } });
        await tx.productwarehouses.update({ where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId: document.warehouseId } }, data: {
          stock_quantity: document.type === "IMPORT" ? { increment: quantity } : { decrement: quantity }, updatedAt: now,
        } });
        await tx.inventory_ledger.create({ data: {
          sourceType: "INVENTORY_DOCUMENT", sourceId: id, sourceLineId: line.id, documentCode: document.code || String(id),
          direction: document.type === "IMPORT" ? "IN" : "OUT", packagingId: line.packagingId, warehouseId: document.warehouseId,
          quantity: decimal(quantity), unitCost: decimal(unitCost), totalValue: money(quantity * unitCost), occurredAt, createdBy: userId,
        } });
      }
      const row = await tx.inventorytransactions.update({ where: { id }, data: { documentStatus: "POSTED", postedAt: occurredAt, postedBy: userId, version: { increment: 1 }, updatedAt: now }, include: inventoryInclude });
      await tx.audit_logs.create({ data: { action: "Ghi sổ phiếu kho v1", details: row.code || String(id), userId, userName: String(userId), createdAt: now } });
      return mapInventoryDocument(row);
    }, { timeout: 30_000 });
  },
  async cancel(id: number, input: InventoryCancelInput, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockDocument(tx, id); assertVersion(current, input.version);
      if (current.documentStatus !== "POSTED" || current.sourceModule !== "MANUAL_V1") throw new HttpError(409, "INVALID_STATUS", "Chỉ được hủy phiếu kho V1 đã ghi sổ");
      const document = await tx.inventorytransactions.findUnique({ where: { id }, include: inventoryInclude });
      if (!document?.warehouseId) throw new HttpError(409, "MISSING_WAREHOUSE", "Chứng từ chưa có kho");
      const originalLedger = await tx.inventory_ledger.findMany({ where: { sourceType: "INVENTORY_DOCUMENT", sourceId: id } });
      if (originalLedger.length !== document.inventorytransactiondetails.length) throw new HttpError(409, "LEDGER_NOT_FOUND", "Không đủ ledger gốc để đảo chứng từ");
      const now = nowIso(), occurredAt = new Date(), reversalType = document.type === "IMPORT" ? "EXPORT" : "IMPORT";
      const reversal = await tx.inventorytransactions.create({ data: {
        code: `H-${document.code}`, type: reversalType, transaction_date: now.slice(0, 10),
        entry_date: reversalType === "IMPORT" ? now.slice(0, 10) : null, exit_date: reversalType === "EXPORT" ? now.slice(0, 10) : null,
        warehouseId: document.warehouseId, note: `Đảo ${document.code}: ${input.reason}`, reason: "Hủy phiếu kho v1",
        createdBy: userId, createdAt: now, updatedAt: now, documentStatus: "POSTED", postedAt: occurredAt, postedBy: userId, sourceModule: "REVERSAL_V1",
      } });
      for (const line of document.inventorytransactiondetails) {
        if (!line.packagingId) continue;
        const quantity = Number(line.quantity), balance = await lockBalance(tx, line.packagingId, document.warehouseId);
        if (document.type === "IMPORT" && balance < quantity) throw new HttpError(409, "REVERSAL_STOCK_SHORTAGE", `Không đủ tồn để đảo ${line.productpackagings?.sku || line.packagingId}`);
        const original = originalLedger.find(entry => entry.sourceLineId === line.id);
        const reversalLine = await tx.inventorytransactiondetails.create({ data: { transactionId: reversal.id, packagingId: line.packagingId, quantity, unitCost: line.unitCost, totalValue: line.totalValue, note: input.reason, createdAt: now, updatedAt: now } });
        await tx.productwarehouses.update({ where: { packagingId_warehouseId: { packagingId: line.packagingId, warehouseId: document.warehouseId } }, data: {
          stock_quantity: document.type === "IMPORT" ? { decrement: quantity } : { increment: quantity }, updatedAt: now,
        } });
        await tx.inventory_ledger.create({ data: {
          sourceType: "INVENTORY_DOCUMENT_CANCEL", sourceId: id, sourceLineId: reversalLine.id, documentCode: document.code || String(id),
          direction: document.type === "IMPORT" ? "OUT" : "IN", packagingId: line.packagingId, warehouseId: document.warehouseId,
          quantity: decimal(quantity), unitCost: line.unitCost, totalValue: line.totalValue, reversalOfId: original?.id,
          occurredAt, createdBy: userId,
        } });
      }
      const row = await tx.inventorytransactions.update({ where: { id }, data: { documentStatus: "CANCELLED", cancelledAt: occurredAt, cancelledBy: userId, cancelReason: input.reason, reversalTransactionId: reversal.id, version: { increment: 1 }, updatedAt: now }, include: inventoryInclude });
      await tx.audit_logs.create({ data: { action: "Hủy phiếu kho v1", details: `${row.code}: ${input.reason}`, userId, userName: String(userId), createdAt: now } });
      return mapInventoryDocument(row);
    }, { timeout: 30_000 });
  },
  async balances(query: any) {
    const params: any[] = [];
    let where = "WHERE 1=1";
    if (query.warehouseId) { where += " AND pw.warehouseId=?"; params.push(query.warehouseId); }
    if (query.search) { where += " AND (pp.sku LIKE ? OR pp.name LIKE ? OR p.name LIKE ?)"; params.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`); }
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT pw.packagingId,pw.warehouseId,COALESCE(pw.stock_quantity,0) quantity,
      pp.sku,pp.name packagingName,pp.unit,p.name productName,w.name warehouseName
      FROM productwarehouses pw JOIN productpackagings pp ON pp.id=pw.packagingId JOIN products p ON p.id=pp.productId
      JOIN warehouses w ON w.id=pw.warehouseId ${where} ORDER BY w.name,p.name,pp.name`, ...params);
    return rows.map(row => ({ ...row, quantity: Number(row.quantity) }));
  },
  async reconciliation(query: any) {
    const params: any[] = [];
    let filter = "";
    if (query.warehouseId) { filter = "WHERE x.warehouseId=?"; params.push(query.warehouseId); }
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT x.*, ROUND(x.actualQuantity-x.expectedQuantity,4) difference FROM (
      SELECT pw.packagingId,pw.warehouseId,pp.sku,p.name productName,pp.name packagingName,w.name warehouseName,
        COALESCE(pw.stock_quantity,0) actualQuantity,
        COALESCE(ob.quantity,0)+COALESCE(l.netQuantity,0) expectedQuantity
      FROM productwarehouses pw JOIN productpackagings pp ON pp.id=pw.packagingId JOIN products p ON p.id=pp.productId
      JOIN warehouses w ON w.id=pw.warehouseId
      LEFT JOIN inventory_ledger_opening_balances ob ON ob.packagingId=pw.packagingId AND ob.warehouseId=pw.warehouseId
      LEFT JOIN (SELECT packagingId,warehouseId,SUM(CASE WHEN direction='IN' THEN quantity ELSE -quantity END) netQuantity
        FROM inventory_ledger GROUP BY packagingId,warehouseId) l ON l.packagingId=pw.packagingId AND l.warehouseId=pw.warehouseId
    ) x ${filter} ORDER BY ABS(x.actualQuantity-x.expectedQuantity) DESC,x.warehouseName,x.productName`, ...params);
    const data = rows.map(row => ({ ...row, actualQuantity: Number(row.actualQuantity), expectedQuantity: Number(row.expectedQuantity), difference: Number(row.difference) }));
    return { data, summary: { total: data.length, mismatches: data.filter(row => Math.abs(row.difference) > 0.0001).length } };
  },
};

export const stocktakeService = {
  async list(query: any) {
    const where: Prisma.stocktakesWhereInput = { ...(query.status ? { status: query.status } : {}), ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}) };
    const [rows, total] = await Promise.all([inventoryRepository.stocktakeList(where, (query.page - 1) * query.limit, query.limit), inventoryRepository.stocktakeCount(where)]);
    return { data: rows.map(mapStocktake), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  },
  async get(id: number) {
    const row = await inventoryRepository.stocktakeById(id); if (!row) throw new HttpError(404, "STOCKTAKE_NOT_FOUND", "Không tìm thấy phiếu kiểm kê");
    return mapStocktake(row);
  },
  async create(input: StocktakeDraftInput, userId: number) {
    await validateMaster(input.warehouseId, input.details.map(line => line.packagingId));
    const now = nowIso();
    const row = await prisma.$transaction(async tx => {
      const details = [];
      for (const line of input.details) {
        const expected = await lockBalance(tx, line.packagingId, input.warehouseId);
        details.push({ packagingId: line.packagingId, expected_qty: expected, actual_qty: line.actualQuantity, difference: line.actualQuantity - expected });
      }
      const created = await tx.stocktakes.create({ data: { code: code("KTV1", input.date), date: input.date, status: "DRAFT", note: input.note, warehouseId: input.warehouseId, createdBy: userId, createdAt: now, stocktake_details: { create: details } }, include: stocktakeInclude });
      await tx.audit_logs.create({ data: { action: "Tạo kiểm kê v1", details: created.code || String(created.id), userId, userName: String(userId), createdAt: now } });
      return created;
    });
    return mapStocktake(row);
  },
  async update(id: number, input: StocktakeUpdateInput, userId: number) {
    await validateMaster(input.warehouseId, input.details.map(line => line.packagingId));
    return prisma.$transaction(async tx => {
      const current = await lockStocktake(tx, id); assertVersion(current, input.version);
      if (current.status !== "DRAFT") throw new HttpError(409, "INVALID_STATUS", "Chỉ được sửa kiểm kê nháp");
      const existing = await tx.stocktakes.findUnique({ where: { id }, include: { stocktake_details: true } });
      if (!existing) throw new HttpError(404, "STOCKTAKE_NOT_FOUND", "Không tìm thấy phiếu kiểm kê");
      const retainedSnapshot = new Map(existing.stocktake_details.map(line => [line.packagingId, Number(line.expected_qty || 0)]));
      const warehouseChanged = existing.warehouseId !== input.warehouseId;
      const details = [];
      for (const line of input.details) {
        const expected = !warehouseChanged && retainedSnapshot.has(line.packagingId)
          ? retainedSnapshot.get(line.packagingId)!
          : await lockBalance(tx, line.packagingId, input.warehouseId);
        details.push({ packagingId: line.packagingId, expected_qty: expected, actual_qty: line.actualQuantity, difference: line.actualQuantity - expected });
      }
      await tx.stocktake_details.deleteMany({ where: { stocktakeId: id } });
      const row = await tx.stocktakes.update({ where: { id }, data: { date: input.date, note: input.note, warehouseId: input.warehouseId, version: { increment: 1 }, stocktake_details: { create: details } }, include: stocktakeInclude });
      await tx.audit_logs.create({ data: { action: "Cập nhật kiểm kê v1", details: row.code || String(id), userId, userName: String(userId), createdAt: nowIso() } });
      return mapStocktake(row);
    });
  },
  async complete(id: number, version: number, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockStocktake(tx, id); assertVersion(current, version);
      if (current.status !== "DRAFT") throw new HttpError(409, "INVALID_STATUS", "Phiếu kiểm kê không ở trạng thái nháp");
      const document = await tx.stocktakes.findUnique({ where: { id }, include: stocktakeInclude });
      if (!document?.warehouseId) throw new HttpError(409, "MISSING_WAREHOUSE", "Phiếu kiểm kê chưa chọn kho");
      const warehouseId = document.warehouseId;
      const positive: any[] = [], negative: any[] = [];
      for (const line of document.stocktake_details) {
        if (!line.packagingId) continue;
        const currentBalance = await lockBalance(tx, line.packagingId, warehouseId);
        if (Math.abs(currentBalance - Number(line.expected_qty || 0)) > 0.0001) throw new HttpError(409, "BOOK_STOCK_CHANGED", `Tồn sổ sách của ${line.productpackagings?.sku || line.packagingId} đã thay đổi; hãy tải lại kiểm kê`);
        const difference = Number(line.actual_qty || 0) - currentBalance;
        if (difference > 0.0001) positive.push({ line, quantity: difference });
        if (difference < -0.0001) negative.push({ line, quantity: Math.abs(difference) });
      }
      const now = nowIso(), occurredAt = new Date();
      const postGroup = async (type: "IMPORT" | "EXPORT", lines: any[]) => {
        if (!lines.length) return;
        const txCode = code(type === "IMPORT" ? "PN-KK" : "PX-KK", document.date || now.slice(0, 10));
        const header = await tx.inventorytransactions.create({ data: { code: txCode, type, transaction_date: document.date || now.slice(0, 10), entry_date: type === "IMPORT" ? document.date : null, exit_date: type === "EXPORT" ? document.date : null, warehouseId, note: `Điều chỉnh kiểm kê ${document.code}`, reason: "Kiểm kê v1", createdBy: userId, createdAt: now, updatedAt: now, documentStatus: "POSTED", postedAt: occurredAt, postedBy: userId, sourceModule: "STOCKTAKE_V1" } });
        for (const item of lines) {
          const packagingId = Number(item.line.packagingId);
          const unitCost = await averageCost(tx, packagingId, warehouseId);
          await tx.inventorytransactiondetails.create({ data: { transactionId: header.id, packagingId, quantity: item.quantity, unitCost: decimal(unitCost), totalValue: money(item.quantity * unitCost), note: document.code, createdAt: now, updatedAt: now } });
          const balance = await lockBalance(tx, packagingId, warehouseId); await ensureOpening(tx, packagingId, warehouseId, balance);
          if (type === "EXPORT" && balance < item.quantity) throw new HttpError(409, "NEGATIVE_STOCK", "Điều chỉnh kiểm kê làm âm kho");
          await tx.productwarehouses.update({ where: { packagingId_warehouseId: { packagingId, warehouseId } }, data: { stock_quantity: type === "IMPORT" ? { increment: item.quantity } : { decrement: item.quantity }, updatedAt: now } });
          await tx.inventory_ledger.create({ data: { sourceType: "STOCKTAKE", sourceId: id, sourceLineId: item.line.id, documentCode: document.code || String(id), direction: type === "IMPORT" ? "IN" : "OUT", packagingId, warehouseId, quantity: decimal(item.quantity), unitCost: decimal(unitCost), totalValue: money(item.quantity * unitCost), occurredAt, createdBy: userId } });
        }
        await tx.stocktake_document_links_v1.create({ data: { stocktakeId: id, linkType: type === "IMPORT" ? "ADJUSTMENT_IMPORT" : "ADJUSTMENT_EXPORT", linkedId: BigInt(header.id), linkedCode: txCode } });
      };
      await postGroup("IMPORT", positive); await postGroup("EXPORT", negative);
      const row = await tx.stocktakes.update({ where: { id }, data: { status: "COMPLETED", completedAt: occurredAt, completedBy: userId, version: { increment: 1 } }, include: stocktakeInclude });
      await tx.audit_logs.create({ data: { action: "Chốt kiểm kê v1", details: row.code || String(id), userId, userName: String(userId), createdAt: now } });
      return mapStocktake(row);
    }, { timeout: 30_000 });
  },
  async cancel(id: number, input: InventoryCancelInput, userId: number) {
    return prisma.$transaction(async tx => {
      const current = await lockStocktake(tx, id); assertVersion(current, input.version);
      if (current.status !== "COMPLETED") throw new HttpError(409, "INVALID_STATUS", "Chỉ được hủy kiểm kê đã chốt");
      const document = await tx.stocktakes.findUnique({ where: { id }, include: stocktakeInclude });
      if (!document?.warehouseId) throw new HttpError(409, "MISSING_WAREHOUSE", "Phiếu kiểm kê chưa có kho");
      const entries = await tx.inventory_ledger.findMany({ where: { sourceType: "STOCKTAKE", sourceId: id } });
      const now = nowIso(), occurredAt = new Date();
      for (const originalDirection of ["IN", "OUT"] as const) {
        const group = entries.filter(entry => entry.direction === originalDirection);
        if (!group.length) continue;
        const reversalType = originalDirection === "IN" ? "EXPORT" : "IMPORT";
        const reversalCode = code(reversalType === "IMPORT" ? "PN-HKK" : "PX-HKK", now.slice(0, 10));
        const reversal = await tx.inventorytransactions.create({ data: {
          code: reversalCode, type: reversalType, transaction_date: now.slice(0, 10),
          entry_date: reversalType === "IMPORT" ? now.slice(0, 10) : null,
          exit_date: reversalType === "EXPORT" ? now.slice(0, 10) : null,
          warehouseId: document.warehouseId, note: `Đảo kiểm kê ${document.code}: ${input.reason}`,
          reason: "Hủy kiểm kê v1", createdBy: userId, createdAt: now, updatedAt: now,
          documentStatus: "POSTED", postedAt: occurredAt, postedBy: userId, sourceModule: "STOCKTAKE_REVERSAL_V1",
        } });
        for (const entry of group) {
          const balance = await lockBalance(tx, entry.packagingId, entry.warehouseId), quantity = Number(entry.quantity);
          if (originalDirection === "IN" && balance < quantity) throw new HttpError(409, "REVERSAL_STOCK_SHORTAGE", "Không đủ tồn để đảo kiểm kê");
          const reversalLine = await tx.inventorytransactiondetails.create({ data: {
            transactionId: reversal.id, packagingId: entry.packagingId, quantity,
            unitCost: entry.unitCost, totalValue: entry.totalValue, note: input.reason, createdAt: now, updatedAt: now,
          } });
          await tx.productwarehouses.update({ where: { packagingId_warehouseId: { packagingId: entry.packagingId, warehouseId: entry.warehouseId } }, data: { stock_quantity: originalDirection === "IN" ? { decrement: quantity } : { increment: quantity }, updatedAt: now } });
          await tx.inventory_ledger.create({ data: { sourceType: "STOCKTAKE_CANCEL", sourceId: id, sourceLineId: reversalLine.id, documentCode: reversalCode, direction: originalDirection === "IN" ? "OUT" : "IN", packagingId: entry.packagingId, warehouseId: entry.warehouseId, quantity: entry.quantity, unitCost: entry.unitCost, totalValue: entry.totalValue, reversalOfId: entry.id, occurredAt, createdBy: userId } });
        }
        await tx.stocktake_document_links_v1.create({ data: {
          stocktakeId: id, linkType: reversalType === "IMPORT" ? "REVERSAL_IMPORT" : "REVERSAL_EXPORT",
          linkedId: BigInt(reversal.id), linkedCode: reversalCode,
        } });
      }
      const row = await tx.stocktakes.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: occurredAt, cancelledBy: userId, cancelReason: input.reason, version: { increment: 1 } }, include: stocktakeInclude });
      await tx.audit_logs.create({ data: { action: "Hủy kiểm kê v1", details: `${row.code}: ${input.reason}`, userId, userName: String(userId), createdAt: now } });
      return mapStocktake(row);
    }, { timeout: 30_000 });
  },
};