import { z } from "zod";

const dateRange = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
}).refine(value => value.from <= value.to, { path: ["to"], message: "Ngày kết thúc phải từ ngày bắt đầu trở đi" });

export const inventorySummaryReportQuerySchema = dateRange.safeExtend({
  warehouseId: z.coerce.number().int().positive().optional(),
  category: z.string().trim().max(50).optional(),
  search: z.string().trim().max(255).optional(),
});

export const itemLedgerReportQuerySchema = dateRange.safeExtend({
  packagingId: z.coerce.number().int().positive(),
  warehouseId: z.coerce.number().int().positive().optional(),
});

export const salesProfitReportQuerySchema = dateRange.safeExtend({
  warehouseId: z.coerce.number().int().positive().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(255).optional(),
});

export const operationsReportQuerySchema = dateRange.safeExtend({
  warehouseId: z.coerce.number().int().positive().optional(),
  type: z.enum(["PRODUCTION", "ASSEMBLY", "DISASSEMBLY"]).optional(),
  search: z.string().trim().max(255).optional(),
});

export const productionVarianceReportQuerySchema = dateRange.safeExtend({
  warehouseId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(255).optional(),
});

export const salesByCustomerReportQuerySchema = dateRange.safeExtend({
  warehouseId: z.coerce.number().int().positive().optional(),
  groupId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(255).optional(),
});

export const salesByProductReportQuerySchema = dateRange.safeExtend({
  warehouseId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(255).optional(),
});

export const productionOverviewReportQuerySchema = dateRange.safeExtend({
  warehouseId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(255).optional(),
});

export const transferReportQuerySchema = dateRange.safeExtend({
  warehouseId: z.coerce.number().int().positive().optional(),
  status: z.enum(["DRAFT", "IN_TRANSIT", "RECEIVED", "CANCELLED"]).optional(),
  search: z.string().trim().max(255).optional(),
});

export type InventorySummaryReportQuery = z.infer<typeof inventorySummaryReportQuerySchema>;
export type ItemLedgerReportQuery = z.infer<typeof itemLedgerReportQuerySchema>;
export type SalesProfitReportQuery = z.infer<typeof salesProfitReportQuerySchema>;
export type OperationsReportQuery = z.infer<typeof operationsReportQuerySchema>;
export type ProductionVarianceReportQuery = z.infer<typeof productionVarianceReportQuerySchema>;
export type SalesByCustomerReportQuery = z.infer<typeof salesByCustomerReportQuerySchema>;
export type SalesByProductReportQuery = z.infer<typeof salesByProductReportQuerySchema>;
export type ProductionOverviewReportQuery = z.infer<typeof productionOverviewReportQuerySchema>;
export type TransferReportQuery = z.infer<typeof transferReportQuerySchema>;