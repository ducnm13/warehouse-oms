import type {
  CatalogListQuery, CatalogPackagingCreateInput, CatalogPackagingUpdateInput,
  CatalogProductCreateInput, CatalogProductUpdateInput,
} from "@challenge/contracts";
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

  async createProduct(input: CatalogProductCreateInput) {
    // Tạo product + packaging đầu tiên
    const product = await catalogRepository.createProduct({
      name: input.name,
      sku: input.sku ?? null,
      category: input.category,
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

    // Tạo quy cách đầu tiên
    const pkg = await catalogRepository.createPackaging({
      productId: product.id,
      name: input.packaging.name,
      sku: input.packaging.sku ?? null,
      unit: input.packaging.unit,
      packCount: input.packaging.packCount,
      netWeight: input.packaging.netWeight,
      shelfLifeMonths: input.packaging.shelfLifeMonths,
      min_stock: input.packaging.min_stock,
      warehouseId: input.packaging.warehouseId ?? null,
      barcode: input.packaging.barcode ?? null,
      isActive: 1,
    });

    // Upsert prices cho packaging
    for (const p of input.packaging.prices ?? []) {
      await catalogRepository.upsertPrice(pkg.id, p.priceType, p.price);
    }

    return catalogRepository.findProductById(product.id);
  },

  async updateProduct(id: number, input: CatalogProductUpdateInput) {
    const row = await catalogRepository.findProductById(id);
    if (!row) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm");

    await catalogRepository.updateProduct(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.sku !== undefined && { sku: input.sku }),
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

  async toggleProduct(id: number, isActive: boolean) {
    const row = await catalogRepository.findProductById(id);
    if (!row) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm");
    return catalogRepository.toggleProductActive(id, isActive ? 1 : 0);
  },

  async getPackaging(id: number) {
    const row = await catalogRepository.findPackagingById(id);
    if (!row || row.deletedAt) throw new HttpError(404, "PACKAGING_NOT_FOUND", "Không tìm thấy quy cách hàng hóa");
    return row;
  },

  async createPackaging(input: CatalogPackagingCreateInput) {
    const product = await catalogRepository.findProductById(input.productId);
    if (!product) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm");

    const pkg = await catalogRepository.createPackaging({
      productId: input.productId,
      name: input.name,
      sku: input.sku ?? null,
      unit: input.unit,
      packCount: input.packCount,
      netWeight: input.netWeight,
      shelfLifeMonths: input.shelfLifeMonths,
      min_stock: input.min_stock,
      warehouseId: input.warehouseId ?? null,
      barcode: input.barcode ?? null,
      isActive: 1,
    });

    for (const p of input.prices ?? []) {
      await catalogRepository.upsertPrice(pkg.id, p.priceType, p.price);
    }

    return catalogRepository.findPackagingById(pkg.id);
  },

  async updatePackaging(id: number, input: CatalogPackagingUpdateInput) {
    const row = await catalogRepository.findPackagingById(id);
    if (!row || row.deletedAt) throw new HttpError(404, "PACKAGING_NOT_FOUND", "Không tìm thấy quy cách hàng hóa");

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

    for (const p of input.prices ?? []) {
      await catalogRepository.upsertPrice(id, p.priceType, p.price);
    }

    return catalogRepository.findPackagingById(id);
  },

  async deletePackaging(id: number) {
    const row = await catalogRepository.findPackagingById(id);
    if (!row || row.deletedAt) throw new HttpError(404, "PACKAGING_NOT_FOUND", "Không tìm thấy quy cách hàng hóa");
    // Kiểm tra không được xóa quy cách cuối cùng
    if (row.products) {
      const product = await catalogRepository.findProductById(row.products.id);
      const active = product?.productpackagings.filter(p => !p.deletedAt) ?? [];
      if (active.length <= 1) throw new HttpError(409, "PACKAGING_LAST_ONE", "Không thể xóa quy cách duy nhất, hãy ẩn sản phẩm thay thế");
    }
    return catalogRepository.softDeletePackaging(id);
  },

  async listWarehouses() {
    return catalogRepository.listWarehouses();
  },

  async listLowStock() {
    return catalogRepository.listLowStock();
  },
};
