import { Router } from "express";
import { numericIdParamsSchema, promotionActionSchema, promotionListQuerySchema, promotionPreviewSchema, promotionProgramSchema, promotionUpdateSchema, promotionUsageQuerySchema } from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";import { authenticateV1, requirePermission } from "../../common/authenticate";import { validateBody, validateParams, validateQuery } from "../../common/validate";import { promotionController } from "./promotion.controller";
export const promotionRouter=Router();promotionRouter.use(authenticateV1);
promotionRouter.get("/",requirePermission("promotion.view"),validateQuery(promotionListQuerySchema),asyncHandler(promotionController.list));
promotionRouter.post("/preview",requirePermission("sales.create"),validateBody(promotionPreviewSchema),asyncHandler(promotionController.preview));
// Route cụ thể phải đứng TRƯỚC "/:id" để không bị nuốt tham số
promotionRouter.get("/usage-summary",requirePermission("promotion.view"),validateQuery(promotionUsageQuerySchema),asyncHandler(promotionController.usageSummary));
promotionRouter.get("/:id",requirePermission("promotion.view"),validateParams(numericIdParamsSchema),asyncHandler(promotionController.get));
promotionRouter.post("/",requirePermission("promotion.manage"),validateBody(promotionProgramSchema),asyncHandler(promotionController.create));
promotionRouter.put("/:id",requirePermission("promotion.manage"),validateParams(numericIdParamsSchema),validateBody(promotionUpdateSchema),asyncHandler(promotionController.update));
promotionRouter.post("/:id/activate",requirePermission("promotion.manage"),validateParams(numericIdParamsSchema),validateBody(promotionActionSchema),asyncHandler(promotionController.activate));
promotionRouter.post("/:id/deactivate",requirePermission("promotion.manage"),validateParams(numericIdParamsSchema),validateBody(promotionActionSchema),asyncHandler(promotionController.deactivate));
promotionRouter.delete("/:id",requirePermission("promotion.manage"),validateParams(numericIdParamsSchema),asyncHandler(promotionController.remove));