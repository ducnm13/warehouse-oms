import { Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { auditController } from "./audit.controller";

export const auditRouter = Router();
auditRouter.use(authenticateV1, requirePermission("audit.view"));

auditRouter.get("/filters", asyncHandler(auditController.filters));
auditRouter.get("/entity/:entityType/:entityId", asyncHandler(auditController.entityHistory));
auditRouter.get("/:id", asyncHandler(auditController.get));
auditRouter.get("/", asyncHandler(auditController.list));
