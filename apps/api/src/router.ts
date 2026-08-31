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
v1Router.get("/system/admin-check", authenticateV1, requirePermission("system.admin"), (_req, res) =>
  res.json({ success: true, message: "Permission hợp lệ", data: { permission: "system.admin" } }),
);