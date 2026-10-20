import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import { authenticateV1, requirePermission } from "./common/authenticate";
import { purchaseRouter } from "./modules/purchasing/purchase.routes";
import { salesRouter } from "./modules/sales/sales.routes";
import { inventoryRouter } from "./modules/inventory/inventory.routes";
import { transferRouter } from "./modules/transfers/transfer.routes";
import { debtRouter } from "./modules/debt/debt.routes";
import { productionRouter } from "./modules/production/production.routes";
import { assemblyRouter } from "./modules/assembly/assembly.routes";
import { reportingRouter } from "./modules/reporting/reporting.routes";
import { promotionRouter } from "./modules/promotions/promotion.routes";
import { salesReturnRouter } from "./modules/sales-returns/sales-return.routes";
import { companyRouter } from "./modules/company/company.routes";
import { employeeRouter } from "./modules/employees/employee.routes";
import { openingInventoryRouter } from "./modules/opening-inventory/opening-inventory.routes";
import { catalogRouter } from "./modules/catalog/catalog.routes";
import { customerGroupRouter } from "./modules/customer-groups/customer-group.routes";
import { onlineRouter } from "./modules/online/online.routes";
import { iamRouter } from "./modules/iam/iam.routes";
import { chatRouter } from "./modules/chat/chat.routes";
import { devtoolsRouter } from "./modules/devtools/devtools.routes";
import { documentCodePrefixes, nextDocumentCode } from "./common/document-code";
import { asyncHandler } from "./common/async-handler";

export const v1Router = Router();
v1Router.get("/health", (_req, res) => res.json({
  success: true, message: "Challenge ERP API hoạt động", data: { status: "ok", version: "v1" },
}));
v1Router.use("/auth", authRouter);
v1Router.use("/purchase-documents", purchaseRouter);
v1Router.use("/sales-documents", salesRouter);
v1Router.use("/inventory", inventoryRouter);
v1Router.use("/warehouse-transfers", transferRouter);
v1Router.use("/debt", debtRouter);
v1Router.use("/production-orders", productionRouter);
v1Router.use("/assembly", assemblyRouter);
v1Router.use("/reports", reportingRouter);
v1Router.use("/promotions", promotionRouter);
v1Router.use("/sales-returns", salesReturnRouter);
v1Router.use("/company", companyRouter);
v1Router.use("/employees", employeeRouter);
v1Router.use("/opening-inventory", openingInventoryRouter);
v1Router.use("/catalog", catalogRouter);
v1Router.use("/customer-groups", customerGroupRouter);
v1Router.use("/online", onlineRouter);
v1Router.use("/iam", iamRouter);
v1Router.use("/chat", chatRouter);
v1Router.use("/devtools", devtoolsRouter);
v1Router.get("/next-code/:scope", authenticateV1, asyncHandler(async (req: any, res: any) => {
  if (!documentCodePrefixes[req.params.scope]) {
    res.status(400).json({ success: false, message: "Phạm vi mã không hợp lệ", data: null });
    return;
  }
  res.json({ success: true, message: "OK", data: { code: await nextDocumentCode(req.params.scope) } });
}));
v1Router.get("/system/admin-check", authenticateV1, requirePermission("system.admin"), (_req, res) =>
  res.json({ success: true, message: "Permission hợp lệ", data: { permission: "system.admin" } }),
);