import { HttpError } from "../../common/http-error";
import { Prisma } from "./assembly.repository";

export const decimal = (value: number) => new Prisma.Decimal(value.toFixed(4));
export const money = (value: number) => new Prisma.Decimal(value.toFixed(2));
export const nowIso = () => new Date().toISOString();
export async function lockBalance(tx: any, packagingId: number, warehouseId: number) {
  await tx.$executeRawUnsafe("INSERT INTO productwarehouses(packagingId,warehouseId,stock_quantity,updatedAt) VALUES(?,?,0,?) ON DUPLICATE KEY UPDATE updatedAt=updatedAt", packagingId, warehouseId, nowIso());
  const rows = await tx.$queryRawUnsafe("SELECT stock_quantity FROM productwarehouses WHERE packagingId=? AND warehouseId=? FOR UPDATE", packagingId, warehouseId) as any[];
  return Number(rows[0]?.stock_quantity || 0);
}
export async function ensureOpening(tx: any, packagingId: number, warehouseId: number, balance: number) {
  const rows = await tx.$queryRawUnsafe("SELECT COALESCE(SUM(CASE WHEN direction='IN' THEN quantity ELSE -quantity END),0) net FROM inventory_ledger WHERE packagingId=? AND warehouseId=?", packagingId, warehouseId) as any[];
  await tx.inventory_ledger_opening_balances.upsert({ where: { packagingId_warehouseId: { packagingId, warehouseId } }, create: { packagingId, warehouseId, quantity: decimal(balance - Number(rows[0].net)) }, update: {} });
}
export async function averageCost(tx: any, packagingId: number, warehouseId: number) {
  const rows = await tx.$queryRawUnsafe("SELECT COALESCE(SUM(CASE WHEN direction='IN' THEN quantity ELSE -quantity END),0) q,COALESCE(SUM(CASE WHEN direction='IN' THEN totalValue ELSE -totalValue END),0) v FROM inventory_ledger WHERE packagingId=? AND warehouseId=?", packagingId, warehouseId) as any[];
  return Number(rows[0].q) > 0 ? Number(rows[0].v) / Number(rows[0].q) : 0;
}
export async function inventoryDocument(tx: any, data: { code: string; type: "IMPORT" | "EXPORT"; warehouseId: number; note: string; sourceModule: string; userId: number; date: string }) {
  const timestamp = nowIso();
  return tx.inventorytransactions.create({ data: { code: data.code, type: data.type, transaction_date: data.date, entry_date: data.type === "IMPORT" ? data.date : null, exit_date: data.type === "EXPORT" ? data.date : null, warehouseId: data.warehouseId, note: data.note, reason: "Lắp ráp / tháo dỡ V1", createdBy: data.userId, createdAt: timestamp, updatedAt: timestamp, documentStatus: "POSTED", postedAt: new Date(), postedBy: data.userId, sourceModule: data.sourceModule } });
}
export function verifyVersion(row: any, version: number) { if (Number(row.version) !== version) throw new HttpError(409, "VERSION_CONFLICT", "Dữ liệu đã thay đổi"); }
export function verifyLinePayload(snapshot: any[], payload: Array<{ lineId: number }>) {
  const ids = payload.map(x => x.lineId), expected = new Set(snapshot.map(x => x.id));
  if (ids.length !== expected.size || new Set(ids).size !== ids.length || ids.some(id => !expected.has(id))) throw new HttpError(422, "LINES_MISMATCH", "Các dòng thực tế phải khớp đầy đủ snapshot");
}