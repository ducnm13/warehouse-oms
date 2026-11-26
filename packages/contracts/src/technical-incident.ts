import { z } from "zod";

export const TECHNICAL_INCIDENT_CATEGORIES = [
  "REPAIR",
  "MAINTENANCE",
  "INSPECTION",
  "OTHER",
] as const;
export const TECHNICAL_INCIDENT_SEVERITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;
export const TECHNICAL_INCIDENT_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CANCELLED",
] as const;

export const technicalIncidentCategorySchema = z.enum(TECHNICAL_INCIDENT_CATEGORIES);
export const technicalIncidentSeveritySchema = z.enum(TECHNICAL_INCIDENT_SEVERITIES);
export const technicalIncidentStatusSchema = z.enum(TECHNICAL_INCIDENT_STATUSES);

const technicalIncidentImageSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z
    .string()
    .trim()
    .regex(/^image\//, "Chỉ chấp nhận tệp hình ảnh")
    .max(100),
  size: z.coerce.number().int().min(0).max(4_000_000),
  dataUrl: z
    .string()
    .trim()
    .min(30)
    .max(5_000_000)
    .refine(
      value => /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value),
      "Dữ liệu hình ảnh không hợp lệ",
    ),
});

export const technicalIncidentSchema = z.object({
  code: z.string().trim().max(100).optional().default(""),
  title: z.string().trim().min(3, "Tên sự cố tối thiểu 3 ký tự").max(255),
  equipmentName: z.string().trim().max(255).optional().default(""),
  location: z.string().trim().max(255).optional().default(""),
  category: technicalIncidentCategorySchema.default("REPAIR"),
  severity: technicalIncidentSeveritySchema.default("MEDIUM"),
  status: technicalIncidentStatusSchema.default("OPEN"),
  occurredAt: z
    .string()
    .trim()
    .min(10, "Nhập thời gian xảy ra sự cố")
    .max(40),
  assigneeId: z.coerce.number().int().positive().optional().nullable(),
  assigneeName: z.string().trim().max(255).optional().default(""),
  cause: z.string().trim().max(5000).optional().default(""),
  solution: z.string().trim().max(5000).optional().default(""),
  cost: z.coerce.number().min(0).max(999_999_999_999).default(0),
  note: z.string().trim().max(500).optional().default(""),
  images: z.array(technicalIncidentImageSchema).max(12).default([]),
});
export type TechnicalIncidentInput = z.infer<typeof technicalIncidentSchema>;
export type TechnicalIncidentImageInput = z.infer<typeof technicalIncidentImageSchema>;

export const technicalIncidentUpdateSchema = technicalIncidentSchema.extend({
  version: z.coerce.number().int().positive(),
  removeImageIds: z.array(z.coerce.number().int().positive()).max(50).default([]),
});
export type TechnicalIncidentUpdateInput = z.infer<typeof technicalIncidentUpdateSchema>;

export const technicalIncidentActionSchema = z.object({
  version: z.coerce.number().int().positive(),
  status: technicalIncidentStatusSchema,
});
export type TechnicalIncidentActionInput = z.infer<typeof technicalIncidentActionSchema>;

export const technicalIncidentDeleteSchema = z.object({
  version: z.coerce.number().int().positive(),
});

export const technicalIncidentListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(255).optional(),
    status: technicalIncidentStatusSchema.optional(),
    severity: technicalIncidentSeveritySchema.optional(),
    category: technicalIncidentCategorySchema.optional(),
    from: z.string().trim().max(10).optional(),
    to: z.string().trim().max(10).optional(),
  })
  .refine(value => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "Ngày kết thúc phải từ ngày bắt đầu trở đi",
  });
export type TechnicalIncidentListQuery = z.infer<typeof technicalIncidentListQuerySchema>;
