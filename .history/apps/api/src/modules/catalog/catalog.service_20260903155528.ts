import type { CatalogListQuery, CatalogPackagingUpdateInput, CatalogProductUpdateInput } from "@challenge/contracts";
import { HttpError } from "../../common/http-error";
import { catalogRepository } from "./catalog.repository";

export const catalogService = {
  async listProducts(query: CatalogListQuery) {
    const where: any = {};
    if (typeof query.isActive === "number") where.isActive = query.isActive;
    if (query.category) where.category = query.category;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { sku: { contains: query.search } },
        { productpackagings: { some: { sku: { contains: query.search } } } },
      ];
    }
    const [rows, total] = await Promise.all([
      catalogRepository.listProducts(where, (query.page - 1) * query.limit, query.limit),
      catalogRepository.countProducts(where),
    ]);
    return { data: rows, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  },

  async getProduct(id: number) {
    const row = await catalogRepository.findProductById(id);
    if (!row) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm");
    return row;
  },

  async updateProduct(id: number, input: CatalogProductUpdateInput) {
    const row = await catalogRepository.findProductById(id);
    if (!row) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm");

    // Cập nhật product flags
    await catalogRepository.updateProduct(id, {
      description: input.description ?? null,
      primaryUnit: input.primaryUnit,
      defaultWarehouseId: input.defaultWarehouseId ?? null,
      vatRate: input.vatRate,
      canManageInventory: input.canManageInventory ? 1 : 0,
      canBePurchased: input.canBePurchased ? 1 : 0,
      canBeSold: input.canBeSold ? 1 : 0,
      canBeProduced: input.canBeProduced ? 1 : 0,
      canBeBomComponent: input.canBeBomComponent ? 1 : 0,
    });

    return catalogRepository.findProductById(id);
  },

  async getPackaging(id: number) {
    const row = await catalogRepository.findPackagingById(id);
    if (!row || row.isActive === 0) throw new HttpError(404, "PACKAGING_NOT_FOUND", "Không tìm thấy quy cách hàng hóa");
    return row;
  },

  async updatePackaging(id: number, input: CatalogPackagingUpdateInput) {
    const row = await catalogRepository.findPackagingById(id);
    if (!row) throw new HttpError(404, "PACKAGING_NOT_FOUND", "Không tìm thấy quy cách hàng hóa");

    await catalogRepository.updatePackaging(id, {
      name: input.name,
      unit: input.unit,
      packCount: input.packCount,
      netWeight: input.netWeight,
      shelfLifeMonths: input.shelfLifeMonths,
      min_stock: input.min_stock,
      warehouseId: input.warehouseId ?? null,
      barcode: input.barcode ?? null,
      isActive: input.isActive ? 1 : 0,
    });

    // Upsert prices
    for (const p of input.prices ?? []) {
      await catalogRepository.upsertPrice(id, p.priceType, p.price);
    }

    return catalogRepository.findPackagingById(id);
  },

  async listWarehouses() {
    return catalogRepository.listWarehouses();
  },
};
