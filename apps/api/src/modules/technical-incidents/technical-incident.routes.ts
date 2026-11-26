import { Router } from "express";
import {
  numericIdParamsSchema,
  technicalIncidentActionSchema,
  technicalIncidentDeleteSchema,
  technicalIncidentListQuerySchema,
  technicalIncidentSchema,
  technicalIncidentUpdateSchema,
} from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams, validateQuery } from "../../common/validate";
import { technicalIncidentController } from "./technical-incident.controller";

export const technicalIncidentRouter = Router();
technicalIncidentRouter.use(authenticateV1);

technicalIncidentRouter.get(
  "/",
  requirePermission("technical.view"),
  validateQuery(technicalIncidentListQuerySchema),
  asyncHandler(technicalIncidentController.list),
);
technicalIncidentRouter.get(
  "/summary",
  requirePermission("technical.view"),
  asyncHandler(technicalIncidentController.summary),
);
technicalIncidentRouter.get(
  "/assignees",
  requirePermission("technical.view"),
  asyncHandler(technicalIncidentController.assignees),
);
technicalIncidentRouter.get(
  "/:id",
  requirePermission("technical.view"),
  validateParams(numericIdParamsSchema),
  asyncHandler(technicalIncidentController.get),
);
technicalIncidentRouter.post(
  "/",
  requirePermission("technical.manage"),
  validateBody(technicalIncidentSchema),
  asyncHandler(technicalIncidentController.create),
);
technicalIncidentRouter.put(
  "/:id",
  requirePermission("technical.manage"),
  validateParams(numericIdParamsSchema),
  validateBody(technicalIncidentUpdateSchema),
  asyncHandler(technicalIncidentController.update),
);
technicalIncidentRouter.post(
  "/:id/status",
  requirePermission("technical.manage"),
  validateParams(numericIdParamsSchema),
  validateBody(technicalIncidentActionSchema),
  asyncHandler(technicalIncidentController.changeStatus),
);
technicalIncidentRouter.post(
  "/:id/delete",
  requirePermission("technical.manage"),
  validateParams(numericIdParamsSchema),
  validateBody(technicalIncidentDeleteSchema),
  asyncHandler(technicalIncidentController.remove),
);
