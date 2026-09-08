import { Router } from "express";
import { employeeCreateSchema, employeeListQuerySchema, employeeUpdateSchema, numericIdParamsSchema } from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams, validateQuery } from "../../common/validate";
import { employeeController } from "./employee.controller";

export const employeeRouter = Router();
employeeRouter.use(authenticateV1);

employeeRouter.get("/", requirePermission("employee.manage"), validateQuery(employeeListQuerySchema), asyncHandler(employeeController.list));
employeeRouter.get("/:id", requirePermission("employee.manage"), validateParams(numericIdParamsSchema), asyncHandler(employeeController.get));
employeeRouter.post("/", requirePermission("employee.manage"), validateBody(employeeCreateSchema), asyncHandler(employeeController.create));
employeeRouter.put("/:id", requirePermission("employee.manage"), validateParams(numericIdParamsSchema), validateBody(employeeUpdateSchema), asyncHandler(employeeController.update));
employeeRouter.delete("/:id", requirePermission("employee.manage"), validateParams(numericIdParamsSchema), asyncHandler(employeeController.delete));
