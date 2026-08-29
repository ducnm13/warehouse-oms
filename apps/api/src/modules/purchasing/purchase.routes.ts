import { Router } from "express";
import { numericIdParamsSchema, purchaseActionSchema, purchaseCancelSchema, purchaseDraftSchema, purchaseListQuerySchema, purchaseUpdateSchema } from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams, validateQuery } from "../../common/validate";
import { purchaseController } from "./purchase.controller";

export const purchaseRouter = Router();
purchaseRouter.use(authenticateV1);
purchaseRouter.get("/", requirePermission("purchase.view"), validateQuery(purchaseListQuerySchema), asyncHandler(purchaseController.list));
purchaseRouter.get("/:id", requirePermission("purchase.view"), validateParams(numericIdParamsSchema), asyncHandler(purchaseController.get));
purchaseRouter.post("/", requirePermission("purchase.create"), validateBody(purchaseDraftSchema), asyncHandler(purchaseController.create));
purchaseRouter.put("/:id", requirePermission("purchase.create"), validateParams(numericIdParamsSchema), validateBody(purchaseUpdateSchema), asyncHandler(purchaseController.update));
purchaseRouter.post("/:id/post", requirePermission("purchase.post"), validateParams(numericIdParamsSchema), validateBody(purchaseActionSchema), asyncHandler(purchaseController.post));
purchaseRouter.post("/:id/cancel", requirePermission("purchase.post"), validateParams(numericIdParamsSchema), validateBody(purchaseCancelSchema), asyncHandler(purchaseController.cancel));