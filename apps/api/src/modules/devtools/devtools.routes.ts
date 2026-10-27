import { Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { devtoolsController } from "./devtools.controller";
import { devtoolsService } from "./devtools.service";
import { isDevToolsAllowed } from "./devtools.access";

export const devtoolsRouter = Router();

devtoolsRouter.use((_req, res, next) => {
  if (!devtoolsService.enabled()) {
    res.status(404).json({ success: false, message: "Không tìm thấy API", data: null });
    return;
  }
  next();
});
devtoolsRouter.use(authenticateV1);
devtoolsRouter.get("/access", (req: any, res: any) => {
  const permissions: string[] = req.auth?.permissions || [];
  const hasAccess = permissions.includes("system.admin") || permissions.includes("devtools.use");
  const allowed = isDevToolsAllowed(req.auth?.username) && hasAccess;
  res.json({ success: true, message: "OK", data: { allowed } });
});
devtoolsRouter.use((req: any, res: any, next: any) => {
  if (!isDevToolsAllowed(req.auth?.username)) {
    res.status(403).json({ success: false, message: "Tài khoản chưa được cấp quyền Dev Tools", data: null });
    return;
  }
  next();
});
devtoolsRouter.use(requirePermission("devtools.use"));

devtoolsRouter.get("/overview", asyncHandler(devtoolsController.overview));
devtoolsRouter.get("/database/tables", asyncHandler(devtoolsController.tables));
devtoolsRouter.get("/database/tables/:name", asyncHandler(devtoolsController.tableData));
devtoolsRouter.post("/database/row", asyncHandler(devtoolsController.updateRow));
devtoolsRouter.post("/database/row/delete", asyncHandler(devtoolsController.deleteRow));
devtoolsRouter.post("/database/query", asyncHandler(devtoolsController.query));
devtoolsRouter.get("/scripts", asyncHandler(devtoolsController.scripts));
devtoolsRouter.post("/scripts/:id/run", asyncHandler(devtoolsController.runScript));
