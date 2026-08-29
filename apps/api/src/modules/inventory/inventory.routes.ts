import { Router } from "express";
import { inventoryActionSchema, inventoryBalanceQuerySchema, inventoryCancelSchema, inventoryDraftSchema, inventoryListQuerySchema, inventoryUpdateSchema, numericIdParamsSchema, stocktakeDraftSchema, stocktakeListQuerySchema, stocktakeUpdateSchema } from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams, validateQuery } from "../../common/validate";
import { inventoryController, stocktakeController } from "./inventory.controller";

export const inventoryRouter = Router();
inventoryRouter.use(authenticateV1);
inventoryRouter.get("/balances", requirePermission("inventory.view"), validateQuery(inventoryBalanceQuerySchema), asyncHandler(inventoryController.balances));
inventoryRouter.get("/reconciliation", requirePermission("inventory.view"), validateQuery(inventoryBalanceQuerySchema), asyncHandler(inventoryController.reconciliation));
inventoryRouter.get("/documents", requirePermission("inventory.view"), validateQuery(inventoryListQuerySchema), asyncHandler(inventoryController.list));
inventoryRouter.get("/documents/:id", requirePermission("inventory.view"), validateParams(numericIdParamsSchema), asyncHandler(inventoryController.get));
inventoryRouter.post("/documents", requirePermission("inventory.manage"), validateBody(inventoryDraftSchema), asyncHandler(inventoryController.create));
inventoryRouter.put("/documents/:id", requirePermission("inventory.manage"), validateParams(numericIdParamsSchema), validateBody(inventoryUpdateSchema), asyncHandler(inventoryController.update));
inventoryRouter.post("/documents/:id/post", requirePermission("inventory.post"), validateParams(numericIdParamsSchema), validateBody(inventoryActionSchema), asyncHandler(inventoryController.post));
inventoryRouter.post("/documents/:id/cancel", requirePermission("inventory.cancel"), validateParams(numericIdParamsSchema), validateBody(inventoryCancelSchema), asyncHandler(inventoryController.cancel));

inventoryRouter.get("/stocktakes", requirePermission("inventory.view"), validateQuery(stocktakeListQuerySchema), asyncHandler(stocktakeController.list));
inventoryRouter.get("/stocktakes/:id", requirePermission("inventory.view"), validateParams(numericIdParamsSchema), asyncHandler(stocktakeController.get));
inventoryRouter.post("/stocktakes", requirePermission("inventory.stocktake"), validateBody(stocktakeDraftSchema), asyncHandler(stocktakeController.create));
inventoryRouter.put("/stocktakes/:id", requirePermission("inventory.stocktake"), validateParams(numericIdParamsSchema), validateBody(stocktakeUpdateSchema), asyncHandler(stocktakeController.update));
inventoryRouter.post("/stocktakes/:id/complete", requirePermission("inventory.stocktake"), validateParams(numericIdParamsSchema), validateBody(inventoryActionSchema), asyncHandler(stocktakeController.complete));
inventoryRouter.post("/stocktakes/:id/cancel", requirePermission("inventory.cancel"), validateParams(numericIdParamsSchema), validateBody(inventoryCancelSchema), asyncHandler(stocktakeController.cancel));