import { Router } from "express";
import { numericIdParamsSchema, salesActionSchema, salesCancelSchema, salesDraftSchema, salesListQuerySchema, salesPaymentSchema, salesRejectSchema, salesUpdateSchema } from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams, validateQuery } from "../../common/validate";
import { salesController } from "./sales.controller";

export const salesRouter = Router();
salesRouter.use(authenticateV1);
salesRouter.get("/", requirePermission("sales.view"), validateQuery(salesListQuerySchema), asyncHandler(salesController.list));
salesRouter.get("/:id", requirePermission("sales.view"), validateParams(numericIdParamsSchema), asyncHandler(salesController.get));
salesRouter.post("/", requirePermission("sales.create"), validateBody(salesDraftSchema), asyncHandler(salesController.create));
salesRouter.put("/:id", requirePermission("sales.create"), validateParams(numericIdParamsSchema), validateBody(salesUpdateSchema), asyncHandler(salesController.update));
salesRouter.post("/:id/submit", requirePermission("sales.create"), validateParams(numericIdParamsSchema), validateBody(salesActionSchema), asyncHandler(salesController.submit));
salesRouter.post("/:id/approve", requirePermission("sales.approve"), validateParams(numericIdParamsSchema), validateBody(salesActionSchema), asyncHandler(salesController.approve));
salesRouter.post("/:id/reject", requirePermission("sales.approve"), validateParams(numericIdParamsSchema), validateBody(salesRejectSchema), asyncHandler(salesController.reject));
salesRouter.post("/:id/post", requirePermission("sales.post"), validateParams(numericIdParamsSchema), validateBody(salesActionSchema), asyncHandler(salesController.post));
salesRouter.post("/:id/payments", requirePermission("debt.receive"), validateParams(numericIdParamsSchema), validateBody(salesPaymentSchema), asyncHandler(salesController.payment));
salesRouter.post("/:id/cancel", requirePermission("sales.cancel"), validateParams(numericIdParamsSchema), validateBody(salesCancelSchema), asyncHandler(salesController.cancel));