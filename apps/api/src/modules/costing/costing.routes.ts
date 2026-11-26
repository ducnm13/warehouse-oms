import { Router } from "express";
import {
  costCenterListQuerySchema,
  costCenterSchema,
  costCenterUpdateSchema,
  costEntryListQuerySchema,
  costEntrySchema,
  costEntryUpdateSchema,
  costSheetCreateSchema,
  costSheetListQuerySchema,
  importIncidentsSchema,
  numericIdParamsSchema,
  unbilledIncidentQuerySchema,
} from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams, validateQuery } from "../../common/validate";
import { costingController } from "./costing.controller";

export const costingRouter = Router();
costingRouter.use(authenticateV1);

// Đối tượng tập hợp chi phí
costingRouter.get(
  "/cost-centers",
  requirePermission("costing.view"),
  validateQuery(costCenterListQuerySchema),
  asyncHandler(costingController.costCenters),
);
costingRouter.post(
  "/cost-centers",
  requirePermission("costing.manage"),
  validateBody(costCenterSchema),
  asyncHandler(costingController.createCostCenter),
);
costingRouter.patch(
  "/cost-centers/:id",
  requirePermission("costing.manage"),
  validateParams(numericIdParamsSchema),
  validateBody(costCenterUpdateSchema),
  asyncHandler(costingController.updateCostCenter),
);

// Danh mục hỗ trợ nhập liệu
costingRouter.get(
  "/warehouses",
  requirePermission("costing.view"),
  asyncHandler(costingController.warehouses),
);
costingRouter.get(
  "/production-orders",
  requirePermission("costing.view"),
  asyncHandler(costingController.productionOrders),
);
costingRouter.get(
  "/assembly-orders",
  requirePermission("costing.view"),
  asyncHandler(costingController.assemblyOrders),
);

// Chứng từ chi phí
costingRouter.get(
  "/entries",
  requirePermission("costing.view"),
  validateQuery(costEntryListQuerySchema),
  asyncHandler(costingController.entries),
);
costingRouter.get(
  "/entries/:id",
  requirePermission("costing.view"),
  validateParams(numericIdParamsSchema),
  asyncHandler(costingController.entry),
);
costingRouter.post(
  "/entries",
  requirePermission("costing.manage"),
  validateBody(costEntrySchema),
  asyncHandler(costingController.createEntry),
);
costingRouter.patch(
  "/entries/:id",
  requirePermission("costing.manage"),
  validateParams(numericIdParamsSchema),
  validateBody(costEntryUpdateSchema),
  asyncHandler(costingController.updateEntry),
);
costingRouter.delete(
  "/entries/:id",
  requirePermission("costing.manage"),
  validateParams(numericIdParamsSchema),
  asyncHandler(costingController.removeEntry),
);

// Sự cố kỹ thuật chưa hạch toán
costingRouter.get(
  "/unbilled-incidents",
  requirePermission("costing.view"),
  validateQuery(unbilledIncidentQuerySchema),
  asyncHandler(costingController.unbilledIncidents),
);
costingRouter.post(
  "/unbilled-incidents/import",
  requirePermission("costing.manage"),
  validateBody(importIncidentsSchema),
  asyncHandler(costingController.importIncidents),
);

// Bảng tính giá thành
costingRouter.get(
  "/sheets",
  requirePermission("costing.view"),
  validateQuery(costSheetListQuerySchema),
  asyncHandler(costingController.sheets),
);
costingRouter.get(
  "/sheets/:id",
  requirePermission("costing.view"),
  validateParams(numericIdParamsSchema),
  asyncHandler(costingController.sheet),
);
costingRouter.post(
  "/sheets",
  requirePermission("costing.manage"),
  validateBody(costSheetCreateSchema),
  asyncHandler(costingController.createSheet),
);
costingRouter.delete(
  "/sheets/:id",
  requirePermission("costing.manage"),
  validateParams(numericIdParamsSchema),
  asyncHandler(costingController.removeSheet),
);
