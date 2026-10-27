import { Router } from "express";
import {
  catalogBomReplaceSchema, catalogImportSchema, catalogListQuerySchema, catalogPackagingCreateSchema, catalogPackagingUpdateSchema,
  catalogProductCreateSchema, catalogProductUpdateSchema, numericIdParamsSchema, priceBookItemParamsSchema,
  warehouseCreateSchema, warehouseUpdateSchema,
  priceBookCreateSchema, priceBookUpdateSchema, priceBookItemSchema, priceBookBulkAddSchema,
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
catalogRouter.get("/packaging-cost-prices", requirePermission("inventory.view"), asyncHandler(catalogController.listCostPrices));
catalogRouter.get("/packaging-retail-prices", requirePermission("sales.view"), asyncHandler(catalogController.listRetailPrices));
catalogRouter.get("/packagings",   requirePermission("catalog.view"),   asyncHandler(catalogController.listPackagings));
catalogRouter.get("/low-stock",    requirePermission("catalog.view"),   asyncHandler(catalogController.listLowStock));

// Customer Group Prices
catalogRouter.get("/group-prices", requirePermission("catalog.view"), asyncHandler(catalogController.listGroupPrices));
catalogRouter.post("/group-prices", requirePermission("catalog.manage"), asyncHandler(catalogController.upsertGroupPrice));

// Price Books
catalogRouter.get("/price-books", requirePermission("catalog.view"), asyncHandler(catalogController.listPriceBooks));
catalogRouter.post("/price-books", requirePermission("catalog.manage"), validateBody(priceBookCreateSchema), asyncHandler(catalogController.createPriceBook));
catalogRouter.get("/price-books/:id", requirePermission("catalog.view"), validateParams(numericIdParamsSchema), asyncHandler(catalogController.getPriceBook));
catalogRouter.put("/price-books/:id", requirePermission("catalog.manage"), validateParams(numericIdParamsSchema), validateBody(priceBookUpdateSchema), asyncHandler(catalogController.updatePriceBook));
catalogRouter.delete("/price-books/:id", requirePermission("catalog.manage"), validateParams(numericIdParamsSchema), asyncHandler(catalogController.deletePriceBook));
catalogRouter.post("/price-books/:id/items", requirePermission("catalog.manage"), validateParams(numericIdParamsSchema), validateBody(priceBookItemSchema), asyncHandler(catalogController.upsertPriceBookItem));
catalogRouter.delete("/price-books/:id/items/:packagingId", requirePermission("catalog.manage"), validateParams(priceBookItemParamsSchema), asyncHandler(catalogController.deletePriceBookItem));
catalogRouter.get("/price-books/:id/items/:packagingId", requirePermission("catalog.view"), validateParams(priceBookItemParamsSchema), asyncHandler(catalogController.getPriceBookItem));
catalogRouter.post("/price-books/:id/bulk-add", requirePermission("catalog.manage"), validateParams(numericIdParamsSchema), validateBody(priceBookBulkAddSchema), asyncHandler(catalogController.bulkAddPriceBookItems));

// Product BOM
catalogRouter.get("/product-boms/:id", requirePermission("catalog.view"), validateParams(numericIdParamsSchema), asyncHandler(catalogController.listBom));
catalogRouter.post("/product-boms/replace", requirePermission("catalog.manage"), validateBody(catalogBomReplaceSchema), asyncHandler(catalogController.replaceBom));

// Products
catalogRouter.post("/products/import", requirePermission("catalog.import"), validateBody(catalogImportSchema), asyncHandler(catalogController.importProducts));
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
