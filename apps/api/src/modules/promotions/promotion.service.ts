import type { PromotionPreviewInput, PromotionProgramInput, PromotionUpdateInput } from "@challenge/contracts";
import { HttpError } from "../../common/http-error";
import { evaluatePromotions } from "./promotion.engine";
import { mapPromotion } from "./promotion.mapper";
import { prisma, promotionInclude, promotionRepository } from "./promotion.repository";

const day = (value: string) => new Date(`${value}T12:00:00.000Z`);
async function validateReferences(input: PromotionProgramInput) {
  const [condition, reward, warehouse] = await Promise.all([promotionRepository.packaging(input.condition.packagingId), promotionRepository.packaging(input.reward.packagingId), promotionRepository.warehouse(input.reward.warehouseId)]);
  if (!condition) throw new HttpError(422, "CONDITION_ITEM_NOT_FOUND", "Hàng hóa điều kiện không tồn tại");
  if (!reward) throw new HttpError(422, "REWARD_ITEM_NOT_FOUND", "Hàng hóa tặng không tồn tại");
  if (!warehouse) throw new HttpError(422, "REWARD_WAREHOUSE_NOT_FOUND", "Kho xuất hàng tặng không tồn tại");
}
const nested = (input: PromotionProgramInput) => ({
  conditions: { create: { conditionType: "BUY_QUANTITY", packagingId: input.condition.packagingId, minimumQuantity: input.condition.minimumQuantity } },
  rewards: { create: { rewardType: "FREE_ITEM", packagingId: input.reward.packagingId, rewardQuantity: input.reward.rewardQuantity, warehouseId: input.reward.warehouseId || null } },
});

export const promotionService = {
  async list(query: { page: number; limit: number; search?: string; status?: string }) {
    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.search) where.OR = [{ code: { contains: query.search } }, { name: { contains: query.search } }];
    const [rows, total] = await Promise.all([promotionRepository.list(where, (query.page - 1) * query.limit, query.limit), promotionRepository.count(where)]);
    return { data: rows.map(mapPromotion), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  },
  async get(id: number) { const row = await promotionRepository.find(id); if (!row || row.deletedAt) throw new HttpError(404, "PROMOTION_NOT_FOUND", "Không tìm thấy chương trình"); return mapPromotion(row); },
  async create(input: PromotionProgramInput, userId: number) {
    await validateReferences(input);
    if (await promotionRepository.codeExists(input.code)) throw new HttpError(409, "PROMOTION_CODE_EXISTS", "Mã chương trình đã tồn tại");
    const row = await prisma.promotion_programs.create({ data: { code: input.code, name: input.name, startDate: day(input.startDate), endDate: day(input.endDate), customerScope: input.customerScope, customerGroup: input.customerScope === "GROUP" ? input.customerGroup : null, priority: input.priority, note: input.note || null, createdBy: userId, updatedAt: new Date(), ...nested(input) }, include: promotionInclude });
    await prisma.audit_logs.create({ data: { action: "Tạo khuyến mãi v1", details: row.code, userId, userName: String(userId), createdAt: new Date().toISOString() } });
    return mapPromotion(row);
  },
  async update(id: number, input: PromotionUpdateInput, userId: number) {
    await validateReferences(input);
    if (await promotionRepository.codeExists(input.code, id)) throw new HttpError(409, "PROMOTION_CODE_EXISTS", "Mã chương trình đã tồn tại");
    return prisma.$transaction(async tx => {
      const current = (await tx.$queryRawUnsafe("SELECT id,status,version FROM promotion_programs WHERE id=? AND deletedAt IS NULL FOR UPDATE", id) as any[])[0];
      if (!current) throw new HttpError(404, "PROMOTION_NOT_FOUND", "Không tìm thấy chương trình");
      if (current.status !== "DRAFT") throw new HttpError(409, "PROMOTION_NOT_EDITABLE", "Chỉ chương trình nháp được sửa");
      if (Number(current.version) !== input.version) throw new HttpError(409, "VERSION_CONFLICT", "Chương trình đã được cập nhật");
      await tx.promotion_conditions.deleteMany({ where: { programId: id } }); await tx.promotion_rewards.deleteMany({ where: { programId: id } });
      const row = await tx.promotion_programs.update({ where: { id }, data: { code: input.code, name: input.name, startDate: day(input.startDate), endDate: day(input.endDate), customerScope: input.customerScope, customerGroup: input.customerScope === "GROUP" ? input.customerGroup : null, priority: input.priority, note: input.note || null, version: { increment: 1 }, updatedAt: new Date(), ...nested(input) }, include: promotionInclude });
      await tx.audit_logs.create({ data: { action: "Cập nhật khuyến mãi v1", details: row.code, userId, userName: String(userId), createdAt: new Date().toISOString() } }); return mapPromotion(row);
    });
  },
  async action(id: number, version: number, status: "ACTIVE" | "INACTIVE", userId: number) {
    return prisma.$transaction(async tx => {
      const current = (await tx.$queryRawUnsafe("SELECT id,code,status,version FROM promotion_programs WHERE id=? AND deletedAt IS NULL FOR UPDATE", id) as any[])[0];
      if (!current) throw new HttpError(404, "PROMOTION_NOT_FOUND", "Không tìm thấy chương trình");
      if (Number(current.version) !== version) throw new HttpError(409, "VERSION_CONFLICT", "Chương trình đã được cập nhật");
      if (current.status === status) throw new HttpError(409, "PROMOTION_STATUS_CONFLICT", "Chương trình đã ở trạng thái yêu cầu");
      const row = await tx.promotion_programs.update({ where: { id }, data: { status, version: { increment: 1 }, updatedAt: new Date() }, include: promotionInclude });
      await tx.audit_logs.create({ data: { action: status === "ACTIVE" ? "Kích hoạt khuyến mãi v1" : "Ngừng khuyến mãi v1", details: row.code, userId, userName: String(userId), createdAt: new Date().toISOString() } }); return mapPromotion(row);
    });
  },
  preview(input: PromotionPreviewInput) { return evaluatePromotions(input); },
};