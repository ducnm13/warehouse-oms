import { Router, type RequestHandler } from "express";
import { assemblyIssueReportQuerySchema, financialSummaryReportQuerySchema, inventorySummaryReportQuerySchema, itemLedgerReportQuerySchema, ledgerDocumentReportQuerySchema, operationsReportQuerySchema, productionOverviewReportQuerySchema, productionVarianceReportQuerySchema, purchaseReportQuerySchema, salesByCustomerReportQuerySchema, salesByProductReportQuerySchema, salesProfitReportQuerySchema, salesReturnReportQuerySchema, stockOnHandReportQuerySchema, transferReportQuerySchema } from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateQuery } from "../../common/validate";
import { reportingController } from "./reporting.controller";

const isWarehouseOnly = (req: Parameters<RequestHandler>[0]) =>
  !!req.auth?.roles.includes("W_MANAGER") && !req.auth.permissions.includes("system.admin");

const moneyFields = new Set([
  "openingValue",
  "inboundValue",
  "outboundValue",
  "closingValue",
  "unitCost",
  "avgUnitCost",
  "totalValue",
  "stockValue",
  "runningValue",
  "inputValue",
  "outputValue",
  "plannedMaterialValue",
  "actualMaterialValue",
  "materialValueVariance",
]);

const stripMoneyFields = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripMoneyFields);
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !moneyFields.has(key))
      .map(([key, item]) => [key, stripMoneyFields(item)]),
  );
};

const maskWarehouseReportMoney: RequestHandler = (req, res, next) => {
  if (!isWarehouseOnly(req)) return next();
  const json = res.json.bind(res);
  res.json = ((body: unknown) => json(stripMoneyFields(body))) as typeof res.json;
  next();
};

const denyWarehouseMoneyReport: RequestHandler = (req, res, next) => {
  if (!isWarehouseOnly(req)) return next();
  res.status(403).json({
    success: false,
    message: "Bạn không có quyền xem báo cáo tài chính",
    error: { code: "PERMISSION_DENIED", message: "Bạn không có quyền xem báo cáo tài chính" },
  });
};

export const reportingRouter = Router();
reportingRouter.use(authenticateV1, requirePermission("report.view"), maskWarehouseReportMoney);
reportingRouter.get("/export-authorization", requirePermission("report.export"), (_req, res) => res.json({ data: { allowed: true } }));
reportingRouter.get("/inventory-summary", validateQuery(inventorySummaryReportQuerySchema), asyncHandler(reportingController.inventorySummary));
reportingRouter.get("/item-ledger", validateQuery(itemLedgerReportQuerySchema), asyncHandler(reportingController.itemLedger));
reportingRouter.get("/item-ledger/document", validateQuery(ledgerDocumentReportQuerySchema), asyncHandler(reportingController.ledgerDocument));
reportingRouter.get("/assembly-issues", validateQuery(assemblyIssueReportQuerySchema), asyncHandler(reportingController.assemblyIssues));
reportingRouter.get("/sales-profit", denyWarehouseMoneyReport, validateQuery(salesProfitReportQuerySchema), asyncHandler(reportingController.salesProfit));
reportingRouter.get("/operations", validateQuery(operationsReportQuerySchema), asyncHandler(reportingController.operations));
reportingRouter.get("/production-variance", validateQuery(productionVarianceReportQuerySchema), asyncHandler(reportingController.productionVariance));
reportingRouter.get("/sales-by-customer", denyWarehouseMoneyReport, validateQuery(salesByCustomerReportQuerySchema), asyncHandler(reportingController.salesByCustomer));
reportingRouter.get("/sales-by-product", denyWarehouseMoneyReport, validateQuery(salesByProductReportQuerySchema), asyncHandler(reportingController.salesByProduct));
reportingRouter.get("/production-overview", validateQuery(productionOverviewReportQuerySchema), asyncHandler(reportingController.productionOverview));
reportingRouter.get("/transfers", validateQuery(transferReportQuerySchema), asyncHandler(reportingController.transfers));
reportingRouter.get("/purchases-by-supplier", denyWarehouseMoneyReport, validateQuery(purchaseReportQuerySchema), asyncHandler(reportingController.purchasesBySupplier));
reportingRouter.get("/purchases-by-product", denyWarehouseMoneyReport, validateQuery(purchaseReportQuerySchema), asyncHandler(reportingController.purchasesByProduct));
reportingRouter.get("/sales-returns", denyWarehouseMoneyReport, validateQuery(salesReturnReportQuerySchema), asyncHandler(reportingController.salesReturns));
reportingRouter.get("/stock-on-hand", validateQuery(stockOnHandReportQuerySchema), asyncHandler(reportingController.stockOnHand));
reportingRouter.get("/financial-summary", denyWarehouseMoneyReport, validateQuery(financialSummaryReportQuerySchema), asyncHandler(reportingController.financialSummary));