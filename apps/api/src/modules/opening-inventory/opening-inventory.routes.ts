import { Router } from "express";
import {
  numericIdParamsSchema,
  openingInventoryActionSchema,
  openingInventoryCancelSchema,
  openingInventoryDraftSchema,
  openingInventoryListQuerySchema,
  openingInventoryUpdateSchema,
} from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams, validateQuery } from "../../common/validate";
import { openingInventoryController } from "./opening-inventory.controller";

export const openingInventoryRouter = Router();
openingInventoryRouter.use(authenticateV1);

openingInventoryRouter.get("/", requirePermission("inventory.opening"), validateQuery(openingInventoryListQuerySchema), asyncHandler(openingInventoryController.list));
openingInventoryRouter.get("/:id", requirePermission("inventory.opening"), validateParams(numericIdParamsSchema), asyncHandler(openingInventoryController.get));
openingInventoryRouter.post("/", requirePermission("inventory.opening"), validateBody(openingInventoryDraftSchema), asyncHandler(openingInventoryController.create));
openingInventoryRouter.put("/:id", requirePermission("inventory.opening"), validateParams(numericIdParamsSchema), validateBody(openingInventoryUpdateSchema), asyncHandler(openingInventoryController.update));
openingInventoryRouter.post("/:id/post", requirePermission("inventory.opening"), validateParams(numericIdParamsSchema), validateBody(openingInventoryActionSchema), asyncHandler(openingInventoryController.post));
openingInventoryRouter.post("/:id/cancel", requirePermission("inventory.opening"), validateParams(numericIdParamsSchema), validateBody(openingInventoryCancelSchema), asyncHandler(openingInventoryController.cancel));
