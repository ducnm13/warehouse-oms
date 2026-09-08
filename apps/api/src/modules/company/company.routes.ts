import { Router } from "express";
import { companyProfileUpdateSchema, printSettingsUpdateSchema, signaturesUpdateSchema } from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody } from "../../common/validate";
import { companyController } from "./company.controller";

export const companyRouter = Router();
companyRouter.use(authenticateV1);

// GET: ai cũng có thể xem để in chứng từ
companyRouter.get("/", asyncHandler(companyController.getAll));

// PUT: chỉ người có quyền company.manage
companyRouter.put(
  "/profile",
  requirePermission("company.manage"),
  validateBody(companyProfileUpdateSchema),
  asyncHandler(companyController.updateProfile),
);
companyRouter.put(
  "/signatures",
  requirePermission("company.manage"),
  validateBody(signaturesUpdateSchema),
  asyncHandler(companyController.updateSignatures),
);
companyRouter.put(
  "/print-settings",
  requirePermission("company.manage"),
  validateBody(printSettingsUpdateSchema),
  asyncHandler(companyController.updatePrintSettings),
);
