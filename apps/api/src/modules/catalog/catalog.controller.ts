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

  replaceBom: async (req: any, res: any) => {
    const data = await catalogService.replaceBom(req.body);
    res.json({ success: true, message: "Đã lưu định mức lắp ráp", data });
  },

  listBom: async (req: any, res: any) => {
    const data = await catalogService.listBom(Number(req.params.id));
    res.json({ success: true, message: "OK", data });
  },

  listCostPrices: async (_req: any, res: any) => {
    const data = await catalogService.listCostPrices();
    res.json({ success: true, message: "OK", data });
  },

  listRetailPrices: async (_req: any, res: any) => {
    const data = await catalogService.listRetailPrices();
    res.json({ success: true, message: "OK", data });
  },

  importProducts: async (req: any, res: any) => {
    const data = await catalogService.importProducts(req.body);
    res.json({ success: true, message: "Đã nhập dữ liệu hàng hóa", data });
  },

  listPackagings: async (req: any, res: any) => {
    const data = await catalogService.listPackagings({
      search: req.query.search as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, message: "OK", data });
  },

  listWarehouses: async (_req: any, res: any) => {
    const data = await catalogService.listWarehouses();
    res.json({ success: true, message: "OK", data });
  },

  listLowStock: async (_req: any, res: any) => {
    const data = await catalogService.listLowStock();
    res.json({ success: true, message: "OK", data });
  },

  listGroupPrices: async (_req: any, res: any) => {
    const data = await catalogService.listGroupPrices();
    res.json({ success: true, message: "OK", data });
  },

  upsertGroupPrice: async (req: any, res: any) => {
    const data = await catalogService.upsertGroupPrice(req.body);
    res.json({ success: true, message: "Đã lưu bảng giá nhóm khách hàng", data });
  },

  listPriceBooks: async (_req: any, res: any) => {
    const data = await catalogService.listPriceBooks();
    res.json({ success: true, message: "OK", data });
  },

  createPriceBook: async (req: any, res: any) => {
    const data = await catalogService.createPriceBook(req.body);
    res.status(201).json({ success: true, message: "Đã tạo bảng giá", data });
  },

  getPriceBook: async (req: any, res: any) => {
    const data = await catalogService.getPriceBook(Number(req.params.id));
    res.json({ success: true, message: "OK", data });
  },

  updatePriceBook: async (req: any, res: any) => {
    const data = await catalogService.updatePriceBook(Number(req.params.id), req.body);
    res.json({ success: true, message: "Đã cập nhật bảng giá", data });
  },

  deletePriceBook: async (req: any, res: any) => {
    await catalogService.deletePriceBook(Number(req.params.id));
    res.json({ success: true, message: "Đã xóa bảng giá", data: null });
  },

  upsertPriceBookItem: async (req: any, res: any) => {
    const data = await catalogService.upsertPriceBookItem(Number(req.params.id), req.body);
    res.json({ success: true, message: "Đã lưu giá sản phẩm", data });
  },

  deletePriceBookItem: async (req: any, res: any) => {
    await catalogService.deletePriceBookItem(Number(req.params.id), Number(req.params.packagingId));
    res.json({ success: true, message: "Đã xóa giá sản phẩm", data: null });
  },

  getPriceBookItem: async (req: any, res: any) => {
    const data = await catalogService.getPriceBookItem(Number(req.params.id), Number(req.params.packagingId));
    res.json({ success: true, message: "OK", data });
  },

  bulkAddPriceBookItems: async (req: any, res: any) => {
    const data = await catalogService.bulkAddPriceBookItems(Number(req.params.id), req.body);
    res.json({ success: true, message: "Đã thêm hàng loạt sản phẩm", data });
  },
};
