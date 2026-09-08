import type { PromotionPreviewInput } from "@challenge/contracts";
import { prisma } from "./promotion.repository";

export type PromotionGiftLine = { packagingId: number; quantity: number; unitPrice: 0; discountRate: 0; note: string; lineType: "PROMOTION"; promotionProgramId: number; promotionCode: string; promotionName: string };

export async function evaluatePromotions(input: PromotionPreviewInput): Promise<PromotionGiftLine[]> {
  const customer = await prisma.customers.findUnique({ where: { id: input.customerId }, select: { groupName: true } });
  if (!customer) return [];
  const day = new Date(`${input.orderDate}T12:00:00.000Z`);
  const programs = await prisma.promotion_programs.findMany({
    where: { deletedAt: null, status: "ACTIVE", startDate: { lte: day }, endDate: { gte: day }, OR: [{ customerScope: "ALL" }, { customerScope: "GROUP", customerGroup: customer.groupName || "" }], conditions: { some: { packagingId: { in: input.details.map(line => line.packagingId) } } }, rewards: { some: { OR: [{ warehouseId: null }, { warehouseId: input.warehouseId }] } } },
    include: { conditions: true, rewards: true }, orderBy: [{ priority: "desc" }, { id: "asc" }],
  });
  const gifts: PromotionGiftLine[] = [];
  for (const saleLine of input.details) {
    const program = programs.find(row => row.conditions.some(condition => condition.packagingId === saleLine.packagingId && saleLine.quantity >= Number(condition.minimumQuantity)));
    if (!program) continue;
    const condition = program.conditions.find(row => row.packagingId === saleLine.packagingId)!;
    const reward = program.rewards.find(row => row.warehouseId == null || row.warehouseId === input.warehouseId);
    if (!reward) continue;
    const tiers = Math.floor((saleLine.quantity + 0.0000001) / Number(condition.minimumQuantity));
    const quantity = tiers * Number(reward.rewardQuantity);
    if (quantity <= 0) continue;
    gifts.push({ packagingId: reward.packagingId, quantity, unitPrice: 0, discountRate: 0, note: `Khuyến mãi ${program.code} - ${program.name}`, lineType: "PROMOTION", promotionProgramId: program.id, promotionCode: program.code, promotionName: program.name });
  }
  return gifts;
}