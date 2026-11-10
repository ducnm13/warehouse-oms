import { devtoolsService } from "./devtools.service";
import {
  getMaintenanceState,
  setMaintenanceState,
} from "../../common/maintenance";

export const devtoolsController = {
  overview: async (_req: any, res: any) => {
    res.json({ success: true, message: "OK", data: await devtoolsService.overview() });
  },

  tables: async (_req: any, res: any) => {
    res.json({ success: true, message: "OK", data: await devtoolsService.tables() });
  },

  query: async (req: any, res: any) => {
    const data = await devtoolsService.query(req.body?.sql);
    res.json({ success: true, message: "OK", data });
  },

  tableData: async (req: any, res: any) => {
    const data = await devtoolsService.tableData(
      String(req.params.name),
      Number(req.query?.limit) || 100,
      Number(req.query?.offset) || 0,
    );
    res.json({ success: true, message: "OK", data });
  },

  updateRow: async (req: any, res: any) => {
    const data = await devtoolsService.updateRow(
      req.body,
      req.auth.userId,
      req.auth.username,
    );
    res.json({ success: true, message: "Đã lưu thay đổi", data });
  },

  deleteRow: async (req: any, res: any) => {
    const data = await devtoolsService.deleteRow(
      req.body,
      req.auth.userId,
      req.auth.username,
    );
    res.json({ success: true, message: "Đã xóa dòng", data });
  },

  scripts: async (_req: any, res: any) => {
    res.json({
      success: true,
      message: "OK",
      data: { scripts: devtoolsService.scripts(), running: devtoolsService.activeRun() },
    });
  },

  runScript: async (req: any, res: any) => {
    const data = await devtoolsService.runScript(
      String(req.params.id),
      req.auth.userId,
      req.auth.username,
      req.body?.confirm,
      req.body?.params,
    );
    res.json({ success: true, message: "Đã chạy xong script", data });
  },

  backups: async (_req: any, res: any) => {
    res.json({ success: true, message: "OK", data: await devtoolsService.listBackups() });
  },

  maintenance: async (_req: any, res: any) => {
    res.json({ success: true, message: "OK", data: await getMaintenanceState() });
  },

  updateMaintenance: async (req: any, res: any) => {
    const data = await setMaintenanceState({
      enabled: req.body?.enabled === true,
      message: req.body?.message,
      actor: req.auth?.username,
    });
    res.json({
      success: true,
      message: data.enabled ? "Đã bật chế độ bảo trì" : "Đã tắt chế độ bảo trì",
      data,
    });
  },

  restoreBackup: async (req: any, res: any) => {
    const data = await devtoolsService.restoreBackup(
      String(req.body?.file || ""),
      req.auth.userId,
      req.auth.username,
      req.body?.confirm,
    );
    res.json({ success: true, message: "Đã khôi phục CSDL", data });
  },
};
