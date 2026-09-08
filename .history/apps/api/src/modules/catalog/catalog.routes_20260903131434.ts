import { Router } from "express";
import { catalogListQuerySchema, catalogPackagingUpdateSchema, catalogProductUpdateSchema, numericIdParamsSchema } from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams, validateQuery } from "../../common/validate";
import { catalogController } from "./catalog.controller";

export const catalogRouter = Router();
catalogRouter.use(authenticateV1);

catalogRouter.get("/warehouses", requirePermission("catalog.view"), asyncHandler(catalogController.listWarehouses));

catalogRouter.get("/products", requirePermission("catalog.view"), validateQuery(catalogListQuerySchema), asyncHandler(catalogController.listProducts));
catalogRouter.get("/products/:id", requirePermission("catalog.view"), validateParams(numericIdParamsSchema), asyncHandler(catalogController.getProduct));
catalogRouter.put("/products/:id", requirePermission("catalog.manage"), validateParams(numericIdParamsSchema), validateBody(catalogProductUpdateSchema), asyncHandler(catalogController.updateProduct));

catalogRouter.get("/packagings/:id", requirePermission("catalog.view"), validateParams(numericIdParamsSchema), asyncHandler(catalogController.getPackaging));
catalogRouter.put("/packagings/:id", requirePermission("catalog.manage"), validateParams(numericIdParamsSchema), validateBody(catalogPackagingUpdateSchema), asyncHandler(catalogController.updatePackaging));
