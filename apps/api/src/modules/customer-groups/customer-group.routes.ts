import { Router } from "express";
import { customerGroupCreateSchema, customerGroupUpdateSchema, numericIdParamsSchema } from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams } from "../../common/validate";
import { prisma } from "@challenge/database";
import { HttpError } from "../../common/http-error";

export const customerGroupRouter = Router();
customerGroupRouter.use(authenticateV1);

// GET all groups (tree structure)
customerGroupRouter.get("/", requirePermission("customer.view"), asyncHandler(async (_req, res) => {
  const rows = await prisma.customer_groups.findMany({
    where: { isActive: 1 },
    orderBy: { displayOrder: "asc" },
    include: {
      children: { where: { isActive: 1 }, orderBy: { displayOrder: "asc" } },
      priceBook: { select: { id: true, code: true, name: true } },
    },
  });
  res.json({ success: true, message: "OK", data: rows });
}));

// GET teams (groups with isTeam = true)
customerGroupRouter.get("/teams", requirePermission("customer.view"), asyncHandler(async (_req, res) => {
  const rows = await prisma.customer_groups.findMany({
    where: { isActive: 1, isTeam: true },
    orderBy: { displayOrder: "asc" },
    include: {
      parent: { select: { id: true, code: true, name: true } },
      priceBook: { select: { id: true, code: true, name: true } },
    },
  });
  res.json({ success: true, message: "OK", data: rows });
}));

// POST create group
customerGroupRouter.post("/", requirePermission("customer.manage"), validateBody(customerGroupCreateSchema), asyncHandler(async (req, res) => {
  const input = req.body;
  const existing = await prisma.customer_groups.findUnique({ where: { code: input.code } });
  if (existing) throw new HttpError(422, "GROUP_CODE_EXISTS", "Mã nhóm khách hàng đã tồn tại");
  const row = await prisma.customer_groups.create({
    data: {
      code: input.code,
      name: input.name,
      parentId: input.parentId ?? null,
      priceBookId: input.priceBookId ?? null,
      isTeam: input.isTeam ?? false,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ? 1 : 0,
    },
  });
  res.status(201).json({ success: true, message: "Đã thêm nhóm khách hàng", data: row });
}));

// PUT update group
customerGroupRouter.put("/:id", requirePermission("customer.manage"), validateParams(numericIdParamsSchema), validateBody(customerGroupUpdateSchema), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const input = req.body;
  const existing = await prisma.customer_groups.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "GROUP_NOT_FOUND", "Không tìm thấy nhóm khách hàng");
  // Kiểm tra trùng code nếu đổi code
  if (input.code !== existing.code) {
    const dup = await prisma.customer_groups.findUnique({ where: { code: input.code } });
    if (dup && dup.id !== id) throw new HttpError(422, "GROUP_CODE_EXISTS", "Mã nhóm khách hàng đã tồn tại");
  }
  const row = await prisma.customer_groups.update({
    where: { id },
    data: {
      code: input.code,
      name: input.name,
      parentId: input.parentId ?? null,
      priceBookId: input.priceBookId ?? null,
      isTeam: input.isTeam ?? false,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ? 1 : 0,
    },
  });
  res.json({ success: true, message: "Đã cập nhật nhóm khách hàng", data: row });
}));

// DELETE group
customerGroupRouter.delete("/:id", requirePermission("customer.manage"), validateParams(numericIdParamsSchema), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.customer_groups.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "GROUP_NOT_FOUND", "Không tìm thấy nhóm khách hàng");
  // Soft delete: set isActive = 0
  await prisma.customer_groups.update({ where: { id }, data: { isActive: 0 } });
  res.json({ success: true, message: "Đã xóa nhóm khách hàng", data: null });
}));
