import { Router } from "express";
import { numericIdParamsSchema, salesActionSchema, salesCancelSchema, salesDraftSchema, salesListQuerySchema, salesPaymentSchema, salesRejectSchema, salesUpdateSchema } from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams, validateQuery } from "../../common/validate";
import { salesController } from "./sales.controller";

export const salesRouter = Router();
salesRouter.use(authenticateV1);
salesRouter.get("/", requirePermission("sales.view"), validateQuery(salesListQuerySchema), asyncHandler(salesController.list));
// Lưu ý: route cụ thể phải đứng TRƯỚC "/:id", nếu không Express nuốt "packaging-prices" thành id
salesRouter.get("/packaging-prices", requirePermission("sales.view"), asyncHandler(salesController.packagingPrices));
salesRouter.get("/:id", requirePermission("sales.view"), validateParams(numericIdParamsSchema), asyncHandler(salesController.get));
salesRouter.post("/", requirePermission("sales.create"), validateBody(salesDraftSchema), asyncHandler(salesController.create));
salesRouter.put("/:id", requirePermission("sales.create"), validateParams(numericIdParamsSchema), validateBody(salesUpdateSchema), asyncHandler(salesController.update));
salesRouter.delete("/:id", requirePermission("sales.create"), validateParams(numericIdParamsSchema), validateBody(salesActionSchema), asyncHandler(salesController.remove));
salesRouter.post("/:id/post", requirePermission("sales.post"), validateParams(numericIdParamsSchema), validateBody(salesActionSchema), asyncHandler(salesController.post));
salesRouter.post("/:id/unpost", requirePermission("sales.post"), validateParams(numericIdParamsSchema), validateBody(salesActionSchema), asyncHandler(salesController.unpost));
salesRouter.post("/:id/payments", requirePermission("debt.receive"), validateParams(numericIdParamsSchema), validateBody(salesPaymentSchema), asyncHandler(salesController.payment));
salesRouter.post("/:id/cancel", requirePermission("sales.cancel"), validateParams(numericIdParamsSchema), validateBody(salesCancelSchema), asyncHandler(salesController.cancel));