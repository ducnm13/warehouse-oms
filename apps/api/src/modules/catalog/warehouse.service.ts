import { prisma } from "@challenge/database";
import { HttpError } from "../../common/http-error";
import type { WarehouseCreateInput, WarehouseUpdateInput } from "@challenge/contracts";

export const warehouseService = {
  async list() {
    return prisma.warehouses.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { productwarehouses: true, inventorytransactions: true },
        },
      },
    });
  },

  async get(id: number) {
    const warehouse = await prisma.warehouses.findUnique({
      where: { id },
      include: {
        productwarehouses: {
          include: { productpackagings: { include: { products: true } } },
        },
      },
    });
    if (!warehouse) throw new HttpError(404, "WAREHOUSE_NOT_FOUND", "Không tìm thấy kho");
    return warehouse;
  },

  async create(input: WarehouseCreateInput) {
    const existing = await prisma.warehouses.findUnique({ where: { code: input.code } });
    if (existing) throw new HttpError(409, "WAREHOUSE_CODE_EXISTS", "Mã kho đã tồn tại");

    return prisma.warehouses.create({
      data: {
        code: input.code,
        name: input.name,
        type: input.type,
        location: input.location ?? null,
        address: input.address ?? null,
        isActive: 1,
      },
    });
  },

  async update(id: number, input: WarehouseUpdateInput) {
    const warehouse = await prisma.warehouses.findUnique({ where: { id } });
    if (!warehouse) throw new HttpError(404, "WAREHOUSE_NOT_FOUND", "Không tìm thấy kho");

    if (input.code !== warehouse.code) {
      const existing = await prisma.warehouses.findUnique({ where: { code: input.code } });
      if (existing) throw new HttpError(409, "WAREHOUSE_CODE_EXISTS", "Mã kho đã tồn tại");
    }

    return prisma.warehouses.update({
      where: { id },
      data: {
        code: input.code,
        name: input.name,
        type: input.type,
        location: input.location ?? null,
        address: input.address ?? null,
        isActive: input.isActive ? 1 : 0,
      },
    });
  },

  async delete(id: number) {
    const warehouse = await prisma.warehouses.findUnique({
      where: { id },
      include: {
        _count: { select: { productwarehouses: true, inventorytransactions: true } },
      },
    });
    if (!warehouse) throw new HttpError(404, "WAREHOUSE_NOT_FOUND", "Không tìm thấy kho");

    if (warehouse._count.inventorytransactions > 0) {
      throw new HttpError(409, "WAREHOUSE_HAS_TRANSACTIONS", "Kho đã phát sinh chứng từ giao dịch, không thể xóa");
    }

    await prisma.productwarehouses.deleteMany({ where: { warehouseId: id } });
    return prisma.warehouses.delete({ where: { id } });
  },
};

