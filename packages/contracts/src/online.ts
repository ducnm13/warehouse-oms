import { z } from "zod";

// ── Bán hàng online (gộp từ dự án SPX) ──────────────────────────────
export const onlineOrderStatuses = ["Pending", "Packing", "Shipping", "Shipped", "Delivered", "Cancelled"] as const;

export const onlineProductSchema = z.object({
  packagingId: z.coerce.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1).max(255),
  price: z.coerce.number().min(0).max(999999999),
  unit: z.string().trim().max(50).optional().default("Cái"),
  isActive: z.boolean().optional(),
});
export type OnlineProductInput = z.infer<typeof onlineProductSchema>;

export const onlineOrderItemSchema = z.object({
  packagingId: z.coerce.number().int().positive().optional().nullable(),
  productName: z.string().trim().min(1).max(255),
  quantity: z.coerce.number().int().min(1).max(9999),
  price: z.coerce.number().min(0).max(999999999),
  unit: z.string().trim().max(50).optional().default("Cái"),
});

export const onlineOrderSchema = z.object({
  orderCode: z.string().trim().max(50).optional().default(""),
  recipientName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(20),
  address: z.string().trim().min(1).max(255),
  shippingFee: z.coerce.number().min(0).max(999999999).default(0),
  items: z.array(onlineOrderItemSchema).min(1).max(200),
});
export type OnlineOrderInput = z.infer<typeof onlineOrderSchema>;

export const onlineOrderStatusSchema = z.object({
  status: z.enum(onlineOrderStatuses),
});

export const onlineTrackingSchema = z.object({
  tracking_number: z.string().trim().min(1).max(100),
});

export const onlineListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(),
  status: z.enum(onlineOrderStatuses).optional(),
});

export const onlineReportQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  months: z.coerce.number().int().min(1).max(24).default(12),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
