import { z } from "zod";

export const COST_CENTER_CATEGORIES = [
  "ELECTRIC_WATER",
  "LABOR",
  "PACKAGING",
  "EQUIPMENT",
  "MAINTENANCE",
  "OTHER",
] as const;

export const ALLOCATION_METHODS = [
  "BY_ACTUAL_QTY",
  "BY_POWDER_KG",
  "BY_MATERIAL_VALUE",
  "MANUAL",
] as const;

export const COST_ENTRY_STATUSES = ["DRAFT", "POSTED", "CANCELLED"] as const;
export const COST_SHEET_STATUSES = ["DRAFT", "POSTED"] as const;
export const COST_TIERS = ["PACK", "ASSEMBLY"] as const;

export type CostCenterCategory = (typeof COST_CENTER_CATEGORIES)[number];
export type AllocationMethod = (typeof ALLOCATION_METHODS)[number];
export type CostEntryStatus = (typeof COST_ENTRY_STATUSES)[number];
export type CostSheetStatus = (typeof COST_SHEET_STATUSES)[number];
export type CostTier = (typeof COST_TIERS)[number];

export const costCenterCategorySchema = z.enum(COST_CENTER_CATEGORIES);
export const allocationMethodSchema = z.enum(ALLOCATION_METHODS);
export const costEntryStatusSchema = z.enum(COST_ENTRY_STATUSES);
export const costSheetStatusSchema = z.enum(COST_SHEET_STATUSES);
export const costTierSchema = z.enum(COST_TIERS);

const dateString = z.iso.date();
const optionalId = z.coerce.number().int().positive().optional().nullable();

const costCenterCodeSchema = z
  .string()
  .trim()
  .min(2, "Mã đối tượng chi phí tối thiểu 2 ký tự")
  .max(50)
  .regex(/^[A-Za-z0-9_]+$/, "Mã chỉ gồm chữ, số và dấu gạch dưới")
  .transform(value => value.toUpperCase());

export const costCenterSchema = z.object({
  code: costCenterCodeSchema,
  name: z.string().trim().min(1, "Nhập tên đối tượng chi phí").max(255),
  category: costCenterCategorySchema.default("OTHER"),
  defaultAllocationMethod: allocationMethodSchema.default("BY_ACTUAL_QTY"),
  description: z.string().trim().max(5000).optional().default(""),
  isActive: z.boolean().optional().default(true),
});
export type CostCenterInput = z.infer<typeof costCenterSchema>;

export const costCenterUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    category: costCenterCategorySchema.optional(),
    defaultAllocationMethod: allocationMethodSchema.optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine(value => Object.keys(value).length > 0, {
    message: "Không có dữ liệu cần cập nhật",
  });
export type CostCenterUpdateInput = z.infer<typeof costCenterUpdateSchema>;

export const costCenterListQuerySchema = z.object({
  search: z.string().trim().max(255).optional(),
  category: costCenterCategorySchema.optional(),
  isActive: z.enum(["true", "false"]).optional(),
});
export type CostCenterListQuery = z.infer<typeof costCenterListQuerySchema>;

export const costEntrySchema = z
  .object({
    code: z.string().trim().max(100).optional().default(""),
    costDate: dateString,
    costCenterId: z.coerce.number().int().positive(),
    warehouseId: optionalId,
    productionOrderId: optionalId,
    assemblyOrderId: optionalId,
    incidentId: optionalId,
    costTier: costTierSchema.default("PACK"),
    amount: z.coerce.number().min(0).max(999_999_999_999).default(0),
    allocationMethod: allocationMethodSchema.optional().nullable(),
    note: z.string().trim().max(500).optional().default(""),
    status: costEntryStatusSchema.default("POSTED"),
  })
  .refine(
    value => !(value.productionOrderId && value.assemblyOrderId),
    {
      path: ["assemblyOrderId"],
      message: "Chỉ chọn một đối tượng: lệnh sản xuất hoặc lệnh lắp ráp",
    },
  );
export type CostEntryInput = z.infer<typeof costEntrySchema>;

export const costEntryUpdateSchema = z
  .object({
    costDate: dateString.optional(),
    costCenterId: z.coerce.number().int().positive().optional(),
    warehouseId: optionalId,
    productionOrderId: optionalId,
    assemblyOrderId: optionalId,
    incidentId: optionalId,
    costTier: costTierSchema.optional(),
    amount: z.coerce.number().min(0).max(999_999_999_999).optional(),
    allocationMethod: allocationMethodSchema.optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
    status: costEntryStatusSchema.optional(),
  })
  .refine(value => Object.keys(value).length > 0, {
    message: "Không có dữ liệu cần cập nhật",
  });
export type CostEntryUpdateInput = z.infer<typeof costEntryUpdateSchema>;

export const costEntryListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    from: dateString.optional(),
    to: dateString.optional(),
    warehouseId: z.coerce.number().int().positive().optional(),
    costCenterId: z.coerce.number().int().positive().optional(),
    productionOrderId: z.coerce.number().int().positive().optional(),
    assemblyOrderId: z.coerce.number().int().positive().optional(),
    costTier: costTierSchema.optional(),
    status: costEntryStatusSchema.optional(),
    search: z.string().trim().max(255).optional(),
  })
  .refine(value => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "Ngày kết thúc phải từ ngày bắt đầu trở đi",
  });
export type CostEntryListQuery = z.infer<typeof costEntryListQuerySchema>;

export const costSheetCreateSchema = z
  .object({
    fromDate: dateString,
    toDate: dateString,
    warehouseId: optionalId,
    note: z.string().trim().max(500).optional().default(""),
    status: costSheetStatusSchema.default("POSTED"),
  })
  .refine(value => value.fromDate <= value.toDate, {
    path: ["toDate"],
    message: "Ngày kết thúc phải từ ngày bắt đầu trở đi",
  });
export type CostSheetCreateInput = z.infer<typeof costSheetCreateSchema>;

export const costSheetListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    from: dateString.optional(),
    to: dateString.optional(),
    warehouseId: z.coerce.number().int().positive().optional(),
    status: costSheetStatusSchema.optional(),
  })
  .refine(value => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "Ngày kết thúc phải từ ngày bắt đầu trở đi",
  });
export type CostSheetListQuery = z.infer<typeof costSheetListQuerySchema>;

export const unbilledIncidentQuerySchema = z
  .object({
    from: dateString.optional(),
    to: dateString.optional(),
    search: z.string().trim().max(255).optional(),
    limit: z.coerce.number().int().min(1).max(300).default(100),
  })
  .refine(value => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "Ngày kết thúc phải từ ngày bắt đầu trở đi",
  });
export type UnbilledIncidentQuery = z.infer<typeof unbilledIncidentQuerySchema>;

export const importIncidentsSchema = z.object({
  incidentIds: z.array(z.coerce.number().int().positive()).min(1).max(200),
  costCenterId: z.coerce.number().int().positive(),
  status: costEntryStatusSchema.default("POSTED"),
  note: z.string().trim().max(500).optional().default(""),
});
export type ImportIncidentsInput = z.infer<typeof importIncidentsSchema>;
