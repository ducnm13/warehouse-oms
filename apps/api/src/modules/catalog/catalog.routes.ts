import { Router } from "express";
import {
  catalogListQuerySchema, catalogPackagingCreateSchema, catalogPackagingUpdateSchema,
  catalogProductCreateSchema, catalogProductUpdateSchema, numericIdParamsSchema,
  warehouseCreateSchema, warehouseUpdateSchema,
} from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams, validateQuery } from "../../common/validate";
import { catalogController } from "./catalog.controller";
import { warehouseController } from "./warehouse.controller";

export const catalogRouter = Router();
catalogRouter.use(authenticateV1);

// Warehouses Management
catalogRouter.get    ("/warehouses",     requirePermission("catalog.view"),   asyncHandler(warehouseController.list));
catalogRouter.get    ("/warehouses/:id", requirePermission("catalog.view"),   validateParams(numericIdParamsSchema), asyncHandler(warehouseController.get));
catalogRouter.post   ("/warehouses",     requirePermission("catalog.manage"), validateBody(warehouseCreateSchema),    asyncHandler(warehouseController.create));
catalogRouter.put    ("/warehouses/:id", requirePermission("catalog.manage"), validateParams(numericIdParamsSchema), validateBody(warehouseUpdateSchema), asyncHandler(warehouseController.update));
catalogRouter.delete ("/warehouses/:id", requirePermission("catalog.manage"), validateParams(numericIdParamsSchema), asyncHandler(warehouseController.delete));

// Refs
catalogRouter.get("/low-stock",    requirePermission("catalog.view"),   asyncHandler(catalogController.listLowStock));

// Products
catalogRouter.get ("/products",     requirePermission("catalog.view"),   validateQuery(catalogListQuerySchema),       asyncHandler(catalogController.listProducts));
catalogRouter.get ("/products/:id", requirePermission("catalog.view"),   validateParams(numericIdParamsSchema),       asyncHandler(catalogController.getProduct));
catalogRouter.post("/products",     requirePermission("catalog.manage"), validateBody(catalogProductCreateSchema),    asyncHandler(catalogController.createProduct));
catalogRouter.put ("/products/:id", requirePermission("catalog.manage"), validateParams(numericIdParamsSchema), validateBody(catalogProductUpdateSchema), asyncHandler(catalogController.updateProduct));
catalogRouter.patch("/products/:id/toggle", requirePermission("catalog.manage"), validateParams(numericIdParamsSchema), asyncHandler(catalogController.toggleProduct));

// Packagings
catalogRouter.get   ("/packagings/:id", requirePermission("catalog.view"),   validateParams(numericIdParamsSchema), asyncHandler(catalogController.getPackaging));
catalogRouter.post  ("/packagings",     requirePermission("catalog.manage"), validateBody(catalogPackagingCreateSchema), asyncHandler(catalogController.createPackaging));
catalogRouter.put   ("/packagings/:id", requirePermission("catalog.manage"), validateParams(numericIdParamsSchema), validateBody(catalogPackagingUpdateSchema), asyncHandler(catalogController.updatePackaging));
catalogRouter.delete("/packagings/:id", requirePermission("catalog.manage"), validateParams(numericIdParamsSchema), asyncHandler(catalogController.deletePackaging));
