import { catalogService } from "./catalog.service";

export const catalogController = {
  listProducts: async (req: any, res: any) => {
    const data = await catalogService.listProducts(req.query);
    res.json({ success: true, message: "OK", ...data });
  },

  getProduct: async (req: any, res: any) => {
    const data = await catalogService.getProduct(Number(req.params.id));
    res.json({ success: true, message: "OK", data });
  },

  createProduct: async (req: any, res: any) => {
    const data = await catalogService.createProduct(req.body);
    res.status(201).json({ success: true, message: "Đã thêm hàng hóa", data });
  },

  updateProduct: async (req: any, res: any) => {
    const data = await catalogService.updateProduct(Number(req.params.id), req.body);
    res.json({ success: true, message: "Đã cập nhật hàng hóa", data });
  },

  toggleProduct: async (req: any, res: any) => {
    const isActive = req.body.isActive === true || req.body.isActive === 1;
    const data = await catalogService.toggleProduct(Number(req.params.id), isActive);
    res.json({ success: true, message: isActive ? "Đã kích hoạt hàng hóa" : "Đã ẩn hàng hóa", data });
  },

  getPackaging: async (req: any, res: any) => {
    const data = await catalogService.getPackaging(Number(req.params.id));
    res.json({ success: true, message: "OK", data });
  },

  createPackaging: async (req: any, res: any) => {
    const data = await catalogService.createPackaging(req.body);
    res.status(201).json({ success: true, message: "Đã thêm quy cách", data });
  },

  updatePackaging: async (req: any, res: any) => {
    const data = await catalogService.updatePackaging(Number(req.params.id), req.body);
    res.json({ success: true, message: "Đã cập nhật quy cách", data });
  },

  deletePackaging: async (req: any, res: any) => {
    await catalogService.deletePackaging(Number(req.params.id));
    res.json({ success: true, message: "Đã xóa quy cách", data: null });
  },

  listWarehouses: async (_req: any, res: any) => {
    const data = await catalogService.listWarehouses();
    res.json({ success: true, message: "OK", data });
  },

  listLowStock: async (_req: any, res: any) => {
    const data = await catalogService.listLowStock();
    res.json({ success: true, message: "OK", data });
  },
};
