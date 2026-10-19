import { Router } from "express";
import { roleCreateSchema, roleUpdateSchema, userRolesAssignSchema } from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams } from "../../common/validate";
import { numericIdParamsSchema } from "@challenge/contracts";
import { iamController } from "./iam.controller";

export const iamRouter = Router();
iamRouter.use(authenticateV1);
iamRouter.use(requirePermission("iam.manage"));

iamRouter.get("/permissions", asyncHandler(iamController.listPermissions));
iamRouter.get("/roles", asyncHandler(iamController.listRoles));
iamRouter.get("/roles/:id", validateParams(numericIdParamsSchema), asyncHandler(iamController.getRole));
iamRouter.post("/roles", validateBody(roleCreateSchema), asyncHandler(iamController.createRole));
iamRouter.put("/roles/:id", validateParams(numericIdParamsSchema), validateBody(roleUpdateSchema), asyncHandler(iamController.updateRole));
iamRouter.delete("/roles/:id", validateParams(numericIdParamsSchema), asyncHandler(iamController.deleteRole));
iamRouter.put(
  "/users/:id/roles",
  validateParams(numericIdParamsSchema),
  validateBody(userRolesAssignSchema),
  asyncHandler(iamController.assignUserRoles),
);
