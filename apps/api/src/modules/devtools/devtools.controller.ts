import { devtoolsService } from "./devtools.service";

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
    );
    res.json({ success: true, message: "Đã chạy xong script", data });
  },
};
