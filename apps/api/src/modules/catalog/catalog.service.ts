import type {
  CatalogBomReplaceInput, CatalogImportInput, CatalogListQuery, CatalogPackagingCreateInput, CatalogPackagingUpdateInput,
  CatalogProductCreateInput, CatalogProductUpdateInput,
  PriceBookCreateInput, PriceBookUpdateInput, PriceBookItemInput, PriceBookBulkAddInput,
} from "@challenge/contracts";
import { HttpError } from "../../common/http-error";
import { catalogRepository } from "./catalog.repository";
import { prisma } from "@challenge/database";

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
    const normalizedSku = input.sku?.trim() || null;
    const normalizedPackagingSku = input.packaging.sku?.trim() || normalizedSku;
    if (normalizedSku) {
      const existingProduct = await catalogRepository.findProductBySku(normalizedSku);
      if (existingProduct) {
        throw new HttpError(409, "PRODUCT_SKU_EXISTS", `Mã sản phẩm ${normalizedSku} đã tồn tại`);
      }
    }
    if (normalizedPackagingSku) {
      const existingPackaging = await catalogRepository.findPackagingBySku(normalizedPackagingSku);
      if (existingPackaging) {
        throw new HttpError(409, "PACKAGING_SKU_EXISTS", `Mã quy cách ${normalizedPackagingSku} đã tồn tại`);
      }
    }
    // Tạo product + packaging đầu tiên, mỗi mã là một sản phẩm riêng biệt
    const product = await catalogRepository.createProduct({
      name: input.name,
      sku: normalizedSku,
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
      sku: normalizedPackagingSku,
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

  async replaceBom(input: CatalogBomReplaceInput) {
    const output = await catalogRepository.findPackagingById(input.productPackagingId);
    if (!output || output.deletedAt) throw new HttpError(404, "PACKAGING_NOT_FOUND", "Không tìm thấy mã thành phẩm cần cấu hình BOM");
    const outputId = input.productPackagingId;
    const unitToKg: Record<string, number> = { kg: 1, g: 0.001, mg: 0.000001, ton: 1000 };
    const uniqueMaterials = new Map<number, { quantityKg: number | null; displayUnit: string; displayQuantity: number }>();
    for (const item of input.materials) {
      if (item.materialPackagingId === outputId) {
        throw new HttpError(422, "BOM_SELF_REFERENCE", "Mã thành phẩm không được dùng chính nó làm nguyên liệu");
      }
      const unit = (item.unit || "kg").trim();
      if (!unit) throw new HttpError(422, "BOM_UNIT_INVALID", "Đơn vị định mức không được để trống");
      const factor = unitToKg[unit.toLowerCase()];
      const quantity = Number(item.quantity || 0);
      const current = uniqueMaterials.get(item.materialPackagingId);
      if (current && current.displayUnit !== unit) {
        throw new HttpError(422, "BOM_UNIT_MISMATCH", "Một mã nguyên liệu chỉ dùng một đơn vị trong cùng định mức");
      }
      uniqueMaterials.set(item.materialPackagingId, {
        quantityKg: factor ? (current?.quantityKg || 0) + quantity * factor : null,
        displayUnit: unit,
        displayQuantity: (current?.displayQuantity || 0) + quantity,
      });
    }
    const materialIds = [...uniqueMaterials.keys()];
    const found: any[] = await catalogRepository.listPackagings({ id: { in: materialIds } } as any, materialIds.length || 1);
    if (found.length !== materialIds.length) {
      throw new HttpError(404, "BOM_MATERIAL_NOT_FOUND", "Một mã nguyên liệu không tồn tại hoặc đã bị xóa");
    }
    const materialUnits = new Map<number, string>(
      found.map((row: any) => [row.id, String(row.unit || "").trim()]),
    );
    return catalogRepository.replaceBom(outputId, materialIds.map((materialPackagingId) => {
      const material = uniqueMaterials.get(materialPackagingId)!;
      return {
        materialPackagingId,
        quantity: material.displayQuantity,
        unit: material.displayUnit,
      };
    }));
  },

  async listRetailPrices() {
    const rows = await catalogRepository.listRetailPrices();
    return rows.map((row) => ({ packagingId: row.packagingId, priceType: "SALE_3", price: Number(row.price || 0) }));
  },

  async listCostPrices() {
    const rows = await catalogRepository.listCostPrices();
    return rows.map((row) => ({ packagingId: row.packagingId, priceType: "COST", price: Number(row.price || 0) }));
  },

  async listBom(productPackagingId: number) {
    const output = await catalogRepository.findPackagingById(productPackagingId);
    if (!output || output.deletedAt) throw new HttpError(404, "PACKAGING_NOT_FOUND", "Không tìm thấy mã cần xem định mức");
    const rows: any = await catalogRepository.listBomByOutput(productPackagingId);
    return (rows as any[]).map((row: any) => ({
      id: Number(row.id || 0),
      materialPackagingId: Number(row.materialPackagingId || 0),
      quantity: Number(row.quantity || 0),
      unit: row.unit || "kg",
      materialName: row.materialName || "",
      materialSku: row.materialSku || "",
      materialUnit: row.materialUnit || "",
    }));
  },

  async importProducts(input: CatalogImportInput) {
    const summary = { total: input.rows.length, created: 0, updated: 0, skipped: 0, deleted: 0, errors: [] as Array<{ row: number; sku: string; message: string }> };
    const seenInFile = new Set<string>();
    for (let index = 0; index < input.rows.length; index += 1) {
      const row = input.rows[index];
      const sku = row.sku.trim();
      if (seenInFile.has(sku)) {
        summary.errors.push({ row: index + 1, sku, message: `Mã ${sku} bị trùng trong file` });
        continue;
      }
      seenInFile.add(sku);
      try {
        const existing = await catalogRepository.findProductBySku(sku);
        if (!existing && await catalogRepository.findPackagingBySku(sku)) {
          throw new HttpError(409, "PACKAGING_SKU_EXISTS", `Mã quy cách ${sku} đã tồn tại`);
        }
        if (!existing) {
          const product = await catalogRepository.createProduct({
            name: row.name, sku, category: row.category, description: row.description,
            primaryUnit: row.primaryUnit, defaultWarehouseId: row.defaultWarehouseId,
            vatRate: row.vatRate, canManageInventory: 1, canBePurchased: 1,
            canBeSold: row.category === "MATERIAL" ? 0 : 1, canBeProduced: 0, canBeBomComponent: 1,
          });
          const pkg = await catalogRepository.createPackaging({
            productId: product.id, name: row.name, sku, unit: row.primaryUnit,
            packCount: row.packCount, netWeight: 0, shelfLifeMonths: 24,
            min_stock: row.min_stock, warehouseId: row.defaultWarehouseId, barcode: row.barcode, isActive: 1,
          });
          await catalogRepository.upsertPrice(pkg.id, "COST", row.priceCost);
          await catalogRepository.upsertPrice(pkg.id, "SALE_1", row.priceSale1);
          await catalogRepository.upsertPrice(pkg.id, "SALE_2", row.priceSale2);
          await catalogRepository.upsertPrice(pkg.id, "SALE_3", row.priceSale3);
          summary.created += 1;
        } else if (input.mode === "ADD_NEW") {
          summary.skipped += 1;
        } else {
          await catalogRepository.updateProduct(existing.id, {
            name: row.name, description: row.description, primaryUnit: row.primaryUnit,
            defaultWarehouseId: row.defaultWarehouseId, vatRate: row.vatRate,
          });
          const full = await catalogRepository.findProductById(existing.id);
          const packaging = full?.productpackagings?.[0];
          if (packaging) {
            await catalogRepository.updatePackaging(packaging.id, {
              name: row.name, unit: row.primaryUnit, min_stock: row.min_stock,
              warehouseId: row.defaultWarehouseId, barcode: row.barcode,
            });
            await catalogRepository.upsertPrice(packaging.id, "COST", row.priceCost);
            await catalogRepository.upsertPrice(packaging.id, "SALE_1", row.priceSale1);
            await catalogRepository.upsertPrice(packaging.id, "SALE_2", row.priceSale2);
            await catalogRepository.upsertPrice(packaging.id, "SALE_3", row.priceSale3);
          }
          summary.updated += 1;
        }
      } catch (error: any) {
        summary.errors.push({ row: index + 1, sku, message: error?.message || "Không import được dòng này" });
      }
    }
    if (input.mode === "OVERWRITE") {
      const fileSkus = new Set(input.rows.map(row => row.sku.trim()));
      const all = await catalogRepository.listProducts({}, 0, 100000);
      for (const product of all as any[]) {
        if (product.sku && !fileSkus.has(product.sku)) {
          await catalogRepository.toggleProductActive(product.id, 0);
          summary.deleted += 1;
        }
      }
    }
    return summary;
  },

  async listPackagings(query: { search?: string; limit?: number }) {
    const take = Math.min(Math.max(query.limit || 100, 1), 1000);
    const where: any = { isActive: 1 };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { sku: { contains: query.search } },
        { barcode: { contains: query.search } },
        { products: { name: { contains: query.search } } },
      ];
    }
    return catalogRepository.listPackagings(where, take);
  },

  async listWarehouses() {
    return catalogRepository.listWarehouses();
  },

  async listLowStock() {
    return catalogRepository.listLowStock();
  },

  async listGroupPrices() {
    return catalogRepository.listGroupPrices();
  },

  async upsertGroupPrice(input: { customerGroupId: number; priceType: string }) {
    return catalogRepository.upsertGroupPrice(input);
  },

  async listPriceBooks() {
    return prisma.price_books.findMany({
      where: { isActive: true },
      orderBy: { isDefault: "desc" },
    });
  },

  async createPriceBook(input: PriceBookCreateInput) {
    if (input.isDefault) {
      await prisma.price_books.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return prisma.price_books.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        isDefault: input.isDefault ?? false,
        isActive: input.isActive ?? true,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validTo: input.validTo ? new Date(input.validTo) : null,
      },
    });
  },

  async getPriceBook(id: number) {
    const book = await prisma.price_books.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            packaging: {
              include: { products: { select: { id: true, name: true, sku: true, category: true } } },
            },
          },
          orderBy: { packaging: { name: "asc" } },
        },
      },
    });
    if (!book) throw new HttpError(404, "PRICE_BOOK_NOT_FOUND", "Không tìm thấy bảng giá");
    return book;
  },

  async updatePriceBook(id: number, input: PriceBookUpdateInput) {
    if (input.isDefault) {
      await prisma.price_books.updateMany({ where: { isDefault: true, NOT: { id } }, data: { isDefault: false } });
    }
    return prisma.price_books.update({
      where: { id },
      data: {
        ...(input.code !== undefined && { code: input.code }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.validFrom !== undefined && { validFrom: input.validFrom ? new Date(input.validFrom) : null }),
        ...(input.validTo !== undefined && { validTo: input.validTo ? new Date(input.validTo) : null }),
      },
    });
  },

  async deletePriceBook(id: number) {
    const book = await prisma.price_books.findUnique({ where: { id } });
    if (!book) throw new HttpError(404, "PRICE_BOOK_NOT_FOUND", "Không tìm thấy bảng giá");
    await prisma.price_books.delete({ where: { id } });
  },

  async upsertPriceBookItem(priceBookId: number, input: PriceBookItemInput) {
    const book = await prisma.price_books.findUnique({ where: { id: priceBookId } });
    if (!book) throw new HttpError(404, "PRICE_BOOK_NOT_FOUND", "Không tìm thấy bảng giá");
    return prisma.price_book_items.upsert({
      where: { priceBookId_packagingId: { priceBookId, packagingId: input.packagingId } },
      create: {
        priceBookId,
        packagingId: input.packagingId,
        costPrice: input.costPrice,
        salePrice: input.salePrice,
        currency: input.currency ?? "VND",
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validTo: input.validTo ? new Date(input.validTo) : null,
      },
      update: {
        costPrice: input.costPrice,
        salePrice: input.salePrice,
        currency: input.currency ?? "VND",
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validTo: input.validTo ? new Date(input.validTo) : null,
      },
    });
  },

  async deletePriceBookItem(priceBookId: number, packagingId: number) {
    await prisma.price_book_items.delete({
      where: { priceBookId_packagingId: { priceBookId, packagingId } },
    });
  },

  async getPriceBookItem(priceBookId: number, packagingId: number) {
    const item = await prisma.price_book_items.findUnique({
      where: { priceBookId_packagingId: { priceBookId, packagingId } },
      include: {
        packaging: {
          include: { products: { select: { id: true, name: true, sku: true, category: true } } },
        },
      },
    });
    if (!item) return null;
    return {
      packagingId: item.packagingId,
      costPrice: Number(item.costPrice || 0),
      salePrice: Number(item.salePrice || 0),
      currency: item.currency || "VND",
    };
  },

  async bulkAddPriceBookItems(priceBookId: number, input: PriceBookBulkAddInput) {
    const book = await prisma.price_books.findUnique({ where: { id: priceBookId } });
    if (!book) throw new HttpError(404, "PRICE_BOOK_NOT_FOUND", "Không tìm thấy bảng giá");

    // Get products based on mode
    let packagings: any[] = [];
    if (input.mode === "ALL_FINISHED") {
      // Get all finished products (PRODUCT category) that can be sold
      const products = await prisma.products.findMany({
        where: { category: "PRODUCT", canBeSold: 1, isActive: 1 },
        include: {
          productpackagings: { where: { deletedAt: null, isActive: 1 } },
        },
      });
      for (const product of products) {
        for (const pkg of product.productpackagings) {
          // Get COST price from product_prices
          const costPrice = await prisma.product_prices.findUnique({
            where: { packagingId_priceType: { packagingId: pkg.id, priceType: "COST" } },
          });
          packagings.push({
            packagingId: pkg.id,
            costPrice: Number(costPrice?.price || 0),
            salePrice: 0,
            currency: "VND",
            validFrom: book.validFrom,
            validTo: book.validTo,
          });
        }
      }
    } else if (input.mode === "BY_CATEGORY" && input.category) {
      // Get products by category
      const products = await prisma.products.findMany({
        where: { category: input.category, canBeSold: 1, isActive: 1 },
        include: {
          productpackagings: { where: { deletedAt: null, isActive: 1 } },
        },
      });
      for (const product of products) {
        for (const pkg of product.productpackagings) {
          const costPrice = await prisma.product_prices.findUnique({
            where: { packagingId_priceType: { packagingId: pkg.id, priceType: "COST" } },
          });
          packagings.push({
            packagingId: pkg.id,
            costPrice: Number(costPrice?.price || 0),
            salePrice: 0,
            currency: "VND",
            validFrom: book.validFrom,
            validTo: book.validTo,
          });
        }
      }
    } else if (input.packagingIds?.length) {
      // Specific packaging IDs
      for (const packagingId of input.packagingIds) {
        const pkg = await prisma.productpackagings.findUnique({ where: { id: packagingId } });
        if (pkg && !pkg.deletedAt) {
          const costPrice = await prisma.product_prices.findUnique({
            where: { packagingId_priceType: { packagingId: pkg.id, priceType: "COST" } },
          });
          packagings.push({
            packagingId: pkg.id,
            costPrice: Number(costPrice?.price || 0),
            salePrice: 0,
            currency: "VND",
            validFrom: book.validFrom,
            validTo: book.validTo,
          });
        }
      }
    }

    // Bulk upsert
    const results = [];
    for (const pkg of packagings) {
      const item = await prisma.price_book_items.upsert({
        where: { priceBookId_packagingId: { priceBookId, packagingId: pkg.packagingId } },
        create: { priceBookId, ...pkg },
        update: { costPrice: pkg.costPrice, salePrice: pkg.salePrice, currency: pkg.currency, validFrom: pkg.validFrom, validTo: pkg.validTo },
      });
      results.push(item);
    }

    return { added: results.length, items: results };
  },
};
