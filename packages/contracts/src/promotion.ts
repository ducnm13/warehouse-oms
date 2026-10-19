import { z } from "zod";

export const promotionProgramSchema = z.object({
  code: z.string().trim().max(80).optional().default("").transform(value => value.toUpperCase()),
  name: z.string().trim().min(2).max(255),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  customerScope: z.enum(["ALL", "GROUP"]).default("ALL"),
  customerGroup: z.string().trim().max(255).optional().default(""),
  priority: z.coerce.number().int().min(0).max(9999).default(0),
  note: z.string().trim().max(500).optional().default(""),
  condition: z.object({
    packagingId: z.coerce.number().int().positive(),
    minimumQuantity: z.coerce.number().positive().max(999999999),
  }),
  reward: z.object({
    packagingId: z.coerce.number().int().positive(),
    rewardQuantity: z.coerce.number().positive().max(999999999),
    warehouseId: z.coerce.number().int().positive().optional(),
  }),
}).superRefine((value, context) => {
  if (value.endDate < value.startDate) context.addIssue({ code: "custom", path: ["endDate"], message: "Ngày kết thúc phải từ ngày bắt đầu" });
  if (value.customerScope === "GROUP" && !value.customerGroup) context.addIssue({ code: "custom", path: ["customerGroup"], message: "Nhập nhóm khách hàng" });
});

export const promotionUpdateSchema = promotionProgramSchema.extend({ version: z.coerce.number().int().positive() });
export const promotionActionSchema = z.object({ version: z.coerce.number().int().positive() });
export const promotionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).optional(),
});
export const promotionPreviewSchema = z.object({
  orderDate: z.iso.date(),
  customerId: z.coerce.number().int().positive(),
  warehouseId: z.coerce.number().int().positive(),
  details: z.array(z.object({ packagingId: z.coerce.number().int().positive(), quantity: z.coerce.number().positive() })).min(1).max(500),
});
export const promotionUsageQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
}).refine(value => value.from <= value.to, { path: ["to"], message: "Ngày kết thúc phải từ ngày bắt đầu trở đi" });

export type PromotionProgramInput = z.infer<typeof promotionProgramSchema>;
export type PromotionUpdateInput = z.infer<typeof promotionUpdateSchema>;
export type PromotionPreviewInput = z.infer<typeof promotionPreviewSchema>;