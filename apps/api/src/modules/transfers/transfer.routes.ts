import { Router } from "express";
import { numericIdParamsSchema, transferActionSchema, transferCancelSchema, transferDraftSchema, transferListQuerySchema, transferUpdateSchema } from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams, validateQuery } from "../../common/validate";
import { transferController } from "./transfer.controller";

export const transferRouter = Router();
transferRouter.use(authenticateV1);
transferRouter.get("/", requirePermission("transfer.view"), validateQuery(transferListQuerySchema), asyncHandler(transferController.list));
transferRouter.get("/:id", requirePermission("transfer.view"), validateParams(numericIdParamsSchema), asyncHandler(transferController.get));
transferRouter.post("/", requirePermission("transfer.create"), validateBody(transferDraftSchema), asyncHandler(transferController.create));
transferRouter.put("/:id", requirePermission("transfer.create"), validateParams(numericIdParamsSchema), validateBody(transferUpdateSchema), asyncHandler(transferController.update));
transferRouter.post("/:id/ship", requirePermission("transfer.ship"), validateParams(numericIdParamsSchema), validateBody(transferActionSchema), asyncHandler(transferController.ship));
transferRouter.post("/:id/receive", requirePermission("transfer.receive"), validateParams(numericIdParamsSchema), validateBody(transferActionSchema), asyncHandler(transferController.receive));
transferRouter.post("/:id/cancel", requirePermission("transfer.cancel"), validateParams(numericIdParamsSchema), validateBody(transferCancelSchema), asyncHandler(transferController.cancel));