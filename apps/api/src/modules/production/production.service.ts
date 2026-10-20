import type { ProductionCancelInput, ProductionCompleteInput, ProductionConfirmInput, ProductionDeleteInput, ProductionDraftInput, ProductionUpdateInput } from "@challenge/contracts";
import { z } from "zod";
import { resolveDocumentCode } from "../../common/document-code";
import { HttpError } from "../../common/http-error";
import { mapProduction } from "./production.mapper";
import { Prisma, prisma, productionInclude, productionRepository } from "./production.repository";
import { resolveProductionDocumentStatuses } from "./production-status";

const dec = (n: number) => new Prisma.Decimal(n.toFixed(4));
const cash = (n: number) => new Prisma.Decimal(n.toFixed(2));
const now = () => new Date().toISOString();

const addMonths = (dateStr: string, months: number) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};
const shelfLifeOf = (pkg: any) => pkg?.shelfLifeMonths ?? pkg?.products?.shelfLifeMonths ?? 24;

async function inventoryDoc(tx: any, data: { code: string; type: "IMPORT" | "EXPORT"; date: string; warehouseId: number; note: string; sourceModule: string; userId: number }) {
  const at = new Date(), t = now();
  return tx.inventorytransactions.create({
    data: {
      code: data.code, type: data.type, transaction_date: data.date,
      entry_date: data.type === "IMPORT" ? data.date : null,
      exit_date: data.type === "EXPORT" ? data.date : null,
      warehouseId: data.warehouseId, note: data.note, reason: "Sản xuất V1",
      createdBy: data.userId, createdAt: t, updatedAt: t,
      documentStatus: "POSTED", postedAt: at, postedBy: data.userId, sourceModule: data.sourceModule
    }
  });
}

async function lock(tx: any, id: number) {
  const r = await tx.$queryRawUnsafe("SELECT id,status,version,sourceModule FROM productionorders WHERE id=? FOR UPDATE", id) as any[];
  if (!r[0] || r[0].sourceModule !== "PRODUCTION_V1") throw new HttpError(404, "PRODUCTION_NOT_FOUND", "Không tìm thấy lệnh sản xuất V1");
  return r[0];
}

const ver = (r: any, v: number) => { if (Number(r.version) !== v) throw new HttpError(409, "VERSION_CONFLICT", "Dữ liệu đã thay đổi") };

async function bal(tx: any, p: number, w: number) {
  await tx.$executeRawUnsafe("INSERT INTO productwarehouses(packagingId,warehouseId,stock_quantity,updatedAt) VALUES(?,?,0,?) ON DUPLICATE KEY UPDATE updatedAt=updatedAt", p, w, now());
  const r = await tx.$queryRawUnsafe("SELECT stock_quantity FROM productwarehouses WHERE packagingId=? AND warehouseId=? FOR UPDATE", p, w) as any[];
  return Number(r[0]?.stock_quantity || 0);
}

async function opening(tx: any, p: number, w: number, b: number) {
  const r = await tx.$queryRawUnsafe("SELECT COALESCE(SUM(CASE WHEN direction='IN' THEN quantity ELSE -quantity END),0) net FROM inventory_ledger WHERE packagingId=? AND warehouseId=?", p, w) as any[];
  await tx.inventory_ledger_opening_balances.upsert({
    where: { packagingId_warehouseId: { packagingId: p, warehouseId: w } },
    create: { packagingId: p, warehouseId: w, quantity: dec(b - Number(r[0].net)) },
    update: {}
  });
}

async function cost(tx: any, p: number, w: number) {
  const r = await tx.$queryRawUnsafe("SELECT COALESCE(SUM(CASE WHEN direction='IN' THEN quantity ELSE -quantity END),0) q,COALESCE(SUM(CASE WHEN direction='IN' THEN totalValue ELSE -totalValue END),0) v FROM inventory_ledger WHERE packagingId=? AND warehouseId=?", p, w) as any[];
  return Number(r[0].q) > 0 ? Number(r[0].v) / Number(r[0].q) : 0;
}

async function snapshot(tx: any, orderId: number, outputs: any[]) {
  const map = new Map<number, { qty: number; unit: string }>();
  const allocation = outputs.reduce((s, x) => s + Number(x.allocationPercent || 0), 0);
  if (allocation > 0.005 && Math.abs(allocation - 100) > 0.005) throw new HttpError(422, "ALLOCATION_INVALID", "Tổng tỷ lệ phân bổ phải bằng 100% hoặc tất cả bằng 0 để phân bổ theo sản lượng");
  for (const o of outputs) {
    const output = await tx.productpackagings.findUnique({ where: { id: o.packagingId } });
    if (!output) throw new HttpError(422, "OUTPUT_NOT_FOUND", `Mã thành phẩm ${o.packagingId} không tồn tại`);
    const bs = await tx.product_boms.findMany({ where: { productPackagingId: o.packagingId } });
    if (!bs.length) throw new HttpError(422, "BOM_REQUIRED", `Mã ${o.packagingId} chưa có định mức BOM`);
    for (const b of bs) {
      if (!b.materialPackagingId) continue;
      const key = b.materialPackagingId;
      const existing = map.get(key);
      const qty = Number(b.quantity || 0) * o.plannedQuantity;
      if (existing) {
        map.set(key, { qty: existing.qty + qty, unit: b.unit || "" });
      } else {
        map.set(key, { qty, unit: b.unit || "" });
      }
    }
  }
  if (!map.size) throw new HttpError(422, "BOM_REQUIRED", "Lệnh chưa có nguyên vật liệu snapshot");
  await tx.production_order_materials_v1.createMany({ data: [...map].map(([packagingId, value]) => ({ orderId, packagingId, plannedQuantity: dec(value.qty), unit: value.unit || null })) });
}

async function mapProductionWithDocuments(db: any, rows: any[]) {
  const statuses = await resolveProductionDocumentStatuses(db, rows);
  return rows.map(row => ({ ...mapProduction(row), documentStatus: statuses.get(row.id) || "DRAFT" }));
}

async function mapOneProductionWithDocuments(db: any, row: any) {
  return (await mapProductionWithDocuments(db, [row]))[0];
}

export const productionService = {
  async list(q: any) {
    const where: any = { sourceModule: "PRODUCTION_V1", ...(q.status ? { status: q.status } : {}), ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}), ...(q.month ? { order_date: { startsWith: q.month } } : {}), ...(q.search ? { OR: [{ code: { contains: q.search } }, { batch_number: { contains: q.search } }] } : {}) };
    const [r, total] = await Promise.all([productionRepository.list(where, (q.page - 1) * q.limit, q.limit), productionRepository.count(where)]);
    return { data: await mapProductionWithDocuments(prisma, r), meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } };
  },
  async get(id: number) {
    const r = await productionRepository.find(id);
    if (!r || r.sourceModule !== "PRODUCTION_V1") throw new HttpError(404, "PRODUCTION_NOT_FOUND", "Không tìm thấy lệnh");
    return mapOneProductionWithDocuments(prisma, r);
  },
  async create(i: ProductionDraftInput, u: number) {
    return prisma.$transaction(async tx => {
      const wh = await tx.warehouses.findUnique({ where: { id: i.warehouseId } });
      if (!wh) throw new HttpError(422, "WAREHOUSE_NOT_FOUND", "Kho không tồn tại");
      const firstOutput = await tx.productpackagings.findUnique({ where: { id: i.outputs[0].packagingId }, include: { products: true } });
      if (!firstOutput) throw new HttpError(422, "OUTPUT_NOT_FOUND", "Mã thành phẩm không tồn tại");
      const code = await resolveDocumentCode("production", (i as any).code);
      const t = now();
      const r = await tx.productionorders.create({
        data: {
          code, productId: firstOutput.productId, warehouseId: i.warehouseId, order_date: i.orderDate,
          mfg_date: i.mfgDate, exp_date: addMonths(i.mfgDate, shelfLifeOf(firstOutput)), batch_number: i.batchNumber || null, note: i.note || null,
          total_powder_kg: i.totalPowderKg, target_sachets: i.targetSachets,
          total_sachets: i.outputs.reduce((s, x) => s + x.plannedQuantity, 0),
          loss_percent: i.lossPercent, status: "DRAFT", sourceModule: "PRODUCTION_V1",
          createdBy: u, createdAt: t, updatedAt: t,
          productiondetails: { create: i.outputs.map(x => ({ packagingId: x.packagingId, quantity: x.plannedQuantity, allocation_percent: x.allocationPercent, note: x.note, createdAt: t, updatedAt: t })) }
        }, include: productionInclude
      });
      await snapshot(tx, r.id, i.outputs);
      await tx.audit_logs.create({ data: { action: "Tạo lệnh sản xuất v1", details: r.code, userId: u, userName: String(u), createdAt: t } });
      return mapOneProductionWithDocuments(tx, await tx.productionorders.findUnique({ where: { id: r.id }, include: productionInclude }));
    });
  },
  async update(id: number, i: ProductionUpdateInput, u: number) {
    return prisma.$transaction(async tx => {
      const r = await lock(tx, id); ver(r, i.version);
      if (!["DRAFT", "IN_PROGRESS"].includes(r.status)) throw new HttpError(409, "INVALID_STATUS", "Chỉ sửa lệnh nháp hoặc đang sản xuất");
      const t = now();
      if (r.status === "DRAFT") {
        await tx.productiondetails.deleteMany({ where: { orderId: id } });
        await tx.production_order_materials_v1.deleteMany({ where: { orderId: id } });
        const firstOutput = await tx.productpackagings.findUnique({ where: { id: i.outputs[0].packagingId }, include: { products: true } });
        await tx.productionorders.update({
          where: { id },
          data: {
            productId: firstOutput?.productId, warehouseId: i.warehouseId, order_date: i.orderDate,
            mfg_date: i.mfgDate, exp_date: addMonths(i.mfgDate, shelfLifeOf(firstOutput)), batch_number: i.batchNumber || null, note: i.note || null,
            total_powder_kg: i.totalPowderKg, target_sachets: i.targetSachets,
            total_sachets: i.outputs.reduce((s, x) => s + x.plannedQuantity, 0),
            loss_percent: i.lossPercent, version: { increment: 1 }, updatedAt: t,
            productiondetails: { create: i.outputs.map(x => ({ packagingId: x.packagingId, quantity: x.plannedQuantity, allocation_percent: x.allocationPercent, note: x.note, createdAt: t, updatedAt: t })) }
          }
        });
        await snapshot(tx, id, i.outputs);
      } else {
        // Đang sản xuất: sửa thông tin mẻ + bổ sung (mã lệnh, kho, ngày tạo), giữ nguyên dòng chi tiết & số thực tế đã nhập
        const firstOutput = await tx.productpackagings.findUnique({ where: { id: i.outputs[0].packagingId }, include: { products: true } });
        await tx.productionorders.update({
          where: { id },
          data: {
            ...(i.code ? { code: i.code } : {}),
            warehouseId: i.warehouseId,
            order_date: i.orderDate,
            mfg_date: i.mfgDate, exp_date: addMonths(i.mfgDate, shelfLifeOf(firstOutput)), batch_number: i.batchNumber || null, note: i.note || null,
            total_powder_kg: i.totalPowderKg, target_sachets: i.targetSachets,
            loss_percent: i.lossPercent, version: { increment: 1 }, updatedAt: t
          }
        });
      }
      await tx.audit_logs.create({ data: { action: "Cập nhật lệnh sản xuất v1", details: String(id), userId: u, userName: String(u), createdAt: t } });
      return mapOneProductionWithDocuments(tx, await tx.productionorders.findUnique({ where: { id }, include: productionInclude }));
    });
  },
  async linkInventory(id: number, input: { linkType: string; linkedId: number; linkedCode?: string }, u: number) {
    const schema = z.object({ linkType: z.enum(["INVENTORY_ISSUE", "INVENTORY_RECEIPT"]), linkedId: z.coerce.number().int().positive(), linkedCode: z.string().trim().max(255).optional() });
    const value = schema.parse(input);
    return prisma.$transaction(async tx => {
      const r = await lock(tx, id); const t = now();
      await tx.production_order_document_links_v1.upsert({
        where: { orderId_linkType_linkedId: { orderId: id, linkType: value.linkType, linkedId: BigInt(value.linkedId) } },
        create: { orderId: id, linkType: value.linkType, linkedId: BigInt(value.linkedId), linkedCode: value.linkedCode || null, createdAt: new Date() },
        update: { linkedCode: value.linkedCode || null }
      });
      await tx.audit_logs.create({ data: { action: "Liên kết phiếu kho lệnh sản xuất", details: `${id} -> ${value.linkedCode || value.linkedId}`, userId: u, userName: String(u), createdAt: t } });
      return mapOneProductionWithDocuments(tx, await tx.productionorders.findUnique({ where: { id }, include: productionInclude }));
    });
  },
  async confirm(id: number, i: ProductionConfirmInput, u: number) {
    return prisma.$transaction(async tx => {
      const r = await lock(tx, id); ver(r, i.version);
      if (r.status !== "DRAFT") throw new HttpError(409, "INVALID_STATUS", "Chỉ xác nhận lệnh nháp");
      const allocation = i.outputs.reduce((sum, o) => sum + o.allocationPercent, 0);
      if (allocation > 0 && Math.abs(allocation - 100) > 0.01) throw new HttpError(422, "ALLOCATION_INVALID", "Tổng % phân bổ phải bằng 100%");
      const t = now();
      await tx.productiondetails.updateMany({ where: { orderId: id }, data: { allocation_percent: 0 } });
      for (const o of i.outputs) {
        await tx.productiondetails.update({ where: { id: o.detailId }, data: { allocation_percent: o.allocationPercent } });
      }
      const updated = await tx.productionorders.update({
        where: { id }, data: { status: "IN_PROGRESS", startedAt: new Date(), startedBy: u, version: { increment: 1 }, updatedAt: t }, include: productionInclude
      });
      await tx.audit_logs.create({ data: { action: "Xác nhận sản xuất v1", details: updated.code, userId: u, userName: String(u), createdAt: t } });
      return mapOneProductionWithDocuments(tx, updated);
    });
  },
  // CHỐT số lượng: chỉ khóa số thực tế, KHÔNG sinh phiếu kho/ledger/tồn.
  // Phiếu xuất/nhập do bộ phận kho lập riêng ở trang lệnh sản xuất.
  // Cho chốt lại trên lệnh COMPLETED để sửa đổi, bổ sung số lượng.
  async complete(id: number, i: ProductionCompleteInput, u: number) {
    return prisma.$transaction(async tx => {
      const r = await lock(tx, id); ver(r, i.version);
      if (!["IN_PROGRESS", "COMPLETED"].includes(r.status)) throw new HttpError(409, "INVALID_STATUS", "Lệnh chưa xác nhận sản xuất");
      const t = now();
      // SKU phân bổ thêm (chỉ có packagingId) → tạo dòng thành phẩm rồi chốt chung
      const norm: Array<{ detailId: number; actualQuantity: number; note: string }> = [];
      for (const x of i.outputs) {
        let detailId: number | undefined = x.detailId;
        if (!detailId) {
          if (!x.packagingId) throw new HttpError(422, "OUTPUT_NOT_FOUND", "Thiếu mã thành phẩm");
          const pkg = await tx.productpackagings.findUnique({ where: { id: x.packagingId } });
          if (!pkg) throw new HttpError(422, "OUTPUT_NOT_FOUND", `Mã thành phẩm ${x.packagingId} không tồn tại`);
          const dup = await tx.productiondetails.findFirst({ where: { orderId: id, packagingId: x.packagingId } });
          if (dup) detailId = dup.id;
          else {
            const created = await tx.productiondetails.create({ data: { orderId: id, packagingId: x.packagingId, quantity: 0, actual_quantity: 0, allocation_percent: 0, note: x.note || "", createdAt: t, updatedAt: t } });
            detailId = created.id;
          }
        }
        norm.push({ detailId, actualQuantity: Number(x.actualQuantity), note: x.note || "" });
      }
      if (!norm.some(x => x.actualQuantity > 0)) throw new HttpError(422, "ACTUAL_QUANTITY_REQUIRED", "Phải có sản lượng thực tế");
      const details = await tx.productiondetails.findMany({ where: { orderId: id } });
      for (const x of norm) {
        const d = details.find(y => y.id === x.detailId);
        if (!d) throw new HttpError(422, "OUTPUT_NOT_FOUND", "Sai dòng thành phẩm");
        const quantity = Number(x.actualQuantity);
        const unitCost = Number(d.unitCost || 0);
        const totalValue = quantity * unitCost;
        await tx.productiondetails.update({ where: { id: d.id }, data: { actual_quantity: quantity, totalValue: cash(totalValue), note: x.note || "" } });
      }
      for (const x of i.materials || []) {
        if (x.actualQuantity <= 0) continue;
        const m = await tx.production_order_materials_v1.findFirst({ where: { orderId: id, id: BigInt(x.materialId) } });
        if (!m) throw new HttpError(422, "MATERIAL_NOT_FOUND", "Sai dòng NVL");
        const quantity = Number(x.actualQuantity);
        const unitCost = Number(m.unitCost || 0);
        const totalValue = quantity * unitCost;
        await tx.production_order_materials_v1.update({ where: { id: m.id }, data: { actualQuantity: dec(quantity), totalValue: cash(totalValue) } });
      }
      const bumped = await tx.productionorders.update({
        where: { id },
        data: {
          status: "COMPLETED",
          ...(r.status === "COMPLETED" ? {} : { completedAt: new Date(), completedBy: u }),
          version: { increment: 1 },
          updatedAt: t,
        },
      });
      await tx.audit_logs.create({ data: { action: "Chốt hoàn thành sản xuất v1", details: bumped.code, userId: u, userName: String(u), createdAt: t } });
      return mapOneProductionWithDocuments(tx, await tx.productionorders.findUnique({ where: { id }, include: productionInclude }));
    });
  },
  async cancel(id: number, i: ProductionCancelInput, u: number) {
    return prisma.$transaction(async tx => {
      const r = await lock(tx, id); ver(r, i.version);
      if (!["DRAFT", "IN_PROGRESS", "COMPLETED"].includes(r.status)) throw new HttpError(409, "INVALID_STATUS", "Không thể hủy");
      const o = await tx.productionorders.findUnique({ where: { id }, include: productionInclude });
      if (!o?.warehouseId) throw new HttpError(409, "WAREHOUSE_REQUIRED", "Thiếu kho");
      const t = now(), at = new Date();
      // Từ khi CHỐT chỉ khóa số (không sinh bút toán), hủy lệnh COMPLETED chỉ đổi trạng thái.
      // Lệnh cũ đã từng sinh phiếu nhập thì vẫn đảo kho như trước.
      const hasPostings = r.status === "COMPLETED" && !!(await tx.inventory_ledger.findFirst({ where: { sourceType: "PRODUCTION_OUTPUT", sourceId: id }, select: { id: true } }));
      if (hasPostings) {
        const outputDoc = await inventoryDoc(tx, { code: `H-PN-${o.code}`, type: "EXPORT", date: t.slice(0, 10), warehouseId: o.warehouseId, note: `Thu hồi output ${o.code}`, sourceModule: "PRODUCTION_OUTPUT_CANCEL_V1", userId: u });
        const materialDoc = await inventoryDoc(tx, { code: `H-PX-${o.code}`, type: "IMPORT", date: t.slice(0, 10), warehouseId: o.warehouseId, note: `Trả NVL ${o.code}`, sourceModule: "PRODUCTION_MATERIAL_CANCEL_V1", userId: u });
        for (const d of o.productiondetails) {
          const q = Number(d.actual_quantity || 0);
          if (!d.packagingId || q <= 0) continue;
          const b = await bal(tx, d.packagingId, o.warehouseId);
          if (b < q) throw new HttpError(409, "REVERSAL_OUTPUT_SHORTAGE", "Không đủ output để hủy");
          const original = await tx.inventory_ledger.findFirst({ where: { sourceType: "PRODUCTION_OUTPUT", sourceId: id, sourceLineId: d.id } });
          if (!original) throw new HttpError(409, "LEDGER_NOT_FOUND", "Thiếu output ledger");
          const line = await tx.inventorytransactiondetails.create({ data: { transactionId: outputDoc.id, packagingId: d.packagingId, quantity: q, unitCost: d.unitCost, totalValue: d.totalValue, note: i.reason, createdAt: t, updatedAt: t } });
          await tx.productwarehouses.update({ where: { packagingId_warehouseId: { packagingId: d.packagingId, warehouseId: o.warehouseId } }, data: { stock_quantity: { decrement: q }, updatedAt: t } });
          await tx.inventory_ledger.create({ data: { sourceType: "PRODUCTION_OUTPUT_CANCEL", sourceId: id, sourceLineId: line.id, documentCode: o.code!, direction: "OUT", packagingId: d.packagingId, warehouseId: o.warehouseId, quantity: dec(q), unitCost: d.unitCost, totalValue: d.totalValue, reversalOfId: original.id, occurredAt: at, createdBy: u } });
        }
        for (const m of o.production_order_materials_v1) {
          const q = Number(m.actualQuantity || 0);
          if (q <= 0) continue;
          await tx.inventorytransactiondetails.create({ data: { transactionId: materialDoc.id, packagingId: m.packagingId, quantity: q, unitCost: m.unitCost, totalValue: m.totalValue, note: i.reason, createdAt: t, updatedAt: t } });
          await tx.productwarehouses.update({ where: { packagingId_warehouseId: { packagingId: m.packagingId, warehouseId: o.warehouseId } }, data: { stock_quantity: { increment: q }, updatedAt: t } });
          const original = await tx.inventory_ledger.findFirst({ where: { sourceType: "PRODUCTION_MATERIAL_RETURN", sourceId: id, sourceLineId: Number(m.id) } });
          if (original) await tx.inventory_ledger.create({ data: { sourceType: "PRODUCTION_MATERIAL_RETURN_CANCEL", sourceId: id, sourceLineId: Number(m.id), documentCode: o.code!, direction: "OUT", packagingId: m.packagingId, warehouseId: o.warehouseId, quantity: dec(q), unitCost: m.unitCost, totalValue: m.totalValue, reversalOfId: original.id, occurredAt: at, createdBy: u } });
        }
      }
      const updated = await tx.productionorders.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: at, cancelledBy: u, cancelReason: i.reason, version: { increment: 1 }, updatedAt: t }, include: productionInclude });
      await tx.audit_logs.create({ data: { action: "Hủy lệnh sản xuất v1", details: `${updated.code}: ${i.reason}`, userId: u, userName: String(u), createdAt: t } });
      return mapOneProductionWithDocuments(tx, updated);
    }, { timeout: 30000 });
  },
  async delete(id: number, input: ProductionDeleteInput, u: number) {
    return prisma.$transaction(async tx => {
      const r = await lock(tx, id); ver(r, input.version);
      if (!["DRAFT", "CANCELLED"].includes(r.status)) throw new HttpError(409, "INVALID_STATUS", "Chỉ được xóa lệnh sản xuất nháp hoặc đã hủy");
      await tx.productiondetails.deleteMany({ where: { orderId: id } });
      await tx.production_order_materials_v1.deleteMany({ where: { orderId: id } });
      await tx.production_order_document_links_v1.deleteMany({ where: { orderId: id } });
      const row = await tx.productionorders.delete({ where: { id } });
      await tx.audit_logs.create({ data: { action: "Xóa lệnh sản xuất v1", details: `${row.code}`, userId: u, userName: String(u), createdAt: now() } });
      return { success: true, message: "Đã xóa lệnh sản xuất" };
    });
  },

  async syncMaterials(id: number, u: number) {
    return prisma.$transaction(async tx => {
      const order = await tx.productionorders.findUnique({
        where: { id },
        include: {
          productiondetails: true,
          production_order_materials_v1: true,
          production_order_document_links_v1: true,
        },
      });
      if (!order) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy lệnh sản xuất");

      const issueLink = order.production_order_document_links_v1.find(
        l => l.linkType === "INVENTORY_ISSUE"
      );
      if (!issueLink) throw new HttpError(400, "NO_ISSUE_LINK", "Lệnh chưa liên kết phiếu xuất kho");

      const invDoc = await tx.inventorytransactions.findUnique({
        where: { id: Number(issueLink.linkedId) },
        include: { inventorytransactiondetails: true },
      });
      if (!invDoc) throw new HttpError(404, "DOC_NOT_FOUND", "Không tìm thấy phiếu xuất kho");

      const t = now();
      for (const detail of invDoc.inventorytransactiondetails) {
        const material = order.production_order_materials_v1.find(
          m => m.packagingId === detail.packagingId
        );
        if (material) {
          const quantity = Number(detail.quantity);
          const unitCost = Number(detail.unitCost);
          const totalValue = quantity * unitCost;
          await tx.production_order_materials_v1.update({
            where: { id: material.id },
            data: {
              plannedQuantity: dec(quantity),
              actualQuantity: dec(quantity),
              unitCost: dec(unitCost),
              totalValue: cash(totalValue),
            },
          });
        }
      }
      await tx.audit_logs.create({
        data: {
          action: "Đồng bộ NVL từ phiếu xuất",
          details: `${order.code} <- ${invDoc.code}`,
          userId: u,
          userName: String(u),
          createdAt: t,
        },
      });
      return mapOneProductionWithDocuments(tx, await tx.productionorders.findUnique({ where: { id }, include: productionInclude }));
    });
  },
};