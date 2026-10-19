import { Router } from "express";
import {
  numericIdParamsSchema,
  onlineListQuerySchema,
  onlineOrderSchema,
  onlineOrderStatusSchema,
  onlineProductSchema,
  onlineReportQuerySchema,
  onlineTrackingSchema,
} from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams, validateQuery } from "../../common/validate";
import { onlineController } from "./online.controller";

export const onlineRouter = Router();
onlineRouter.use(authenticateV1);

onlineRouter.get("/products", requirePermission("online.view"), asyncHandler(onlineController.listProducts));
onlineRouter.post("/products", requirePermission("online.manage"), validateBody(onlineProductSchema), asyncHandler(onlineController.createProduct));
onlineRouter.put("/products/:id", requirePermission("online.manage"), validateParams(numericIdParamsSchema), validateBody(onlineProductSchema), asyncHandler(onlineController.updateProduct));
onlineRouter.post("/products/sync-names", requirePermission("online.manage"), asyncHandler(onlineController.syncNames));

onlineRouter.get("/orders", requirePermission("online.view"), validateQuery(onlineListQuerySchema), asyncHandler(onlineController.listOrders));
onlineRouter.post("/orders", requirePermission("online.manage"), validateBody(onlineOrderSchema), asyncHandler(onlineController.createOrder));
onlineRouter.put("/orders/:id/status", requirePermission("online.manage"), validateParams(numericIdParamsSchema), validateBody(onlineOrderStatusSchema), asyncHandler(onlineController.updateStatus));
onlineRouter.put("/orders/:id/tracking", requirePermission("online.manage"), validateParams(numericIdParamsSchema), validateBody(onlineTrackingSchema), asyncHandler(onlineController.updateTracking));
onlineRouter.delete("/orders/:id", requirePermission("online.manage"), validateParams(numericIdParamsSchema), asyncHandler(onlineController.remove));

onlineRouter.get("/tracking/:trackingNumber", requirePermission("online.view"), asyncHandler(onlineController.trackingInfo));
onlineRouter.post("/tracking-sync", requirePermission("online.manage"), asyncHandler(onlineController.syncShipments));
onlineRouter.get("/stats", requirePermission("online.view"), asyncHandler(onlineController.stats));
onlineRouter.get("/reports/top-products", requirePermission("online.view"), validateQuery(onlineReportQuerySchema), asyncHandler(onlineController.topProducts));
onlineRouter.get("/reports/monthly", requirePermission("online.view"), validateQuery(onlineReportQuerySchema), asyncHandler(onlineController.monthlyReport));
onlineRouter.get("/next-code", requirePermission("online.manage"), asyncHandler(onlineController.nextCode));
