import { prisma } from "@challenge/database";
import type { RoleCreateInput, RoleUpdateInput } from "@challenge/contracts";
import { HttpError } from "../../common/http-error";

const ADMIN_ROLE_CODE = "ADMIN";

async function roleWithLinks(id: number) {
  const role = await prisma.roles.findUnique({
    where: { id },
    include: {
      role_permissions: { include: { permissions: true } },
      _count: { select: { user_roles: true } },
    },
  });
  if (!role) throw new HttpError(404, "ROLE_NOT_FOUND", "Không tìm thấy vai trò");
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: Boolean(role.isSystem),
    permissionCodes: role.role_permissions.map(link => link.permissions.code),
    userCount: role._count.user_roles,
  };
}

async function resolvePermissionIds(codes: string[]) {
  const uniq = [...new Set(codes.map(code => String(code).trim()).filter(Boolean))];
  if (!uniq.length) return [];
  const rows = await prisma.permissions.findMany({ where: { code: { in: uniq } } });
  const found = new Set(rows.map(row => row.code));
  const missing = uniq.filter(code => !found.has(code));
  if (missing.length) throw new HttpError(422, "PERMISSION_NOT_FOUND", `Quyền không tồn tại: ${missing.join(", ")}`);
  return rows.map(row => row.id);
}

export const iamService = {
  async listPermissions() {
    const rows = await prisma.permissions.findMany({ orderBy: [{ resource: "asc" }, { action: "asc" }] });
    return rows.map(row => ({ id: row.id, code: row.code, name: row.name, resource: row.resource, action: row.action }));
  },

  async listRoles() {
    const rows = await prisma.roles.findMany({
      orderBy: [{ code: "asc" }],
      include: {
        role_permissions: { include: { permissions: true } },
        _count: { select: { user_roles: true } },
      },
    });
    return rows.map(role => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: Boolean(role.isSystem),
      permissionCodes: role.role_permissions.map(link => link.permissions.code),
      userCount: role._count.user_roles,
    }));
  },

  async getRole(id: number) {
    return roleWithLinks(id);
  },

  async createRole(input: RoleCreateInput) {
    const exists = await prisma.roles.findUnique({ where: { code: input.code } });
    if (exists) throw new HttpError(400, "ROLE_CODE_EXISTS", `Mã vai trò '${input.code}' đã tồn tại`);
    const permissionIds = await resolvePermissionIds(input.permissionCodes);
    const role = await prisma.roles.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description || null,
        isSystem: false,
        role_permissions: { create: permissionIds.map(permissionId => ({ permissionId })) },
      },
    });
    return roleWithLinks(role.id);
  },

  async updateRole(id: number, input: RoleUpdateInput) {
    await roleWithLinks(id);
    const permissionIds = await resolvePermissionIds(input.permissionCodes);
    await prisma.$transaction([
      prisma.roles.update({ where: { id }, data: { name: input.name, description: input.description || null } }),
      prisma.role_permissions.deleteMany({ where: { roleId: id } }),
      ...(permissionIds.length
        ? [prisma.role_permissions.createMany({ data: permissionIds.map(permissionId => ({ roleId: id, permissionId })) })]
        : []),
    ]);
    return roleWithLinks(id);
  },

  async deleteRole(id: number) {
    const role = await roleWithLinks(id);
    if (role.isSystem) throw new HttpError(400, "SYSTEM_ROLE_PROTECTED", "Không thể xóa vai trò hệ thống");
    if (role.userCount > 0) throw new HttpError(400, "ROLE_IN_USE", `Vai trò đang gán cho ${role.userCount} tài khoản, gỡ gán trước khi xóa`);
    await prisma.roles.delete({ where: { id } });
    return { success: true };
  },

  async assignUserRoles(userId: number, roleIds: number[]) {
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản");
    const uniq = [...new Set(roleIds)];
    const roles = await prisma.roles.findMany({ where: { id: { in: uniq } } });
    if (roles.length !== uniq.length) throw new HttpError(422, "ROLE_NOT_FOUND", "Vai trò không tồn tại");
    // Không được gỡ vai trò ADMIN khỏi quản trị viên cuối cùng
    const adminRole = roles.find(role => role.code === ADMIN_ROLE_CODE);
    if (!adminRole) {
      const otherAdmins = await prisma.user_roles.count({
        where: { userId: { not: userId }, roles: { code: ADMIN_ROLE_CODE } },
      });
      const selfIsAdmin = await prisma.user_roles.count({
        where: { userId, roles: { code: ADMIN_ROLE_CODE } },
      });
      if (selfIsAdmin > 0 && otherAdmins === 0)
        throw new HttpError(400, "LAST_ADMIN_PROTECTED", "Không thể gỡ vai trò quản trị viên cuối cùng");
    }
    await prisma.$transaction([
      prisma.user_roles.deleteMany({ where: { userId } }),
      prisma.user_roles.createMany({ data: uniq.map(roleId => ({ userId, roleId })) }),
    ]);
    // Đồng bộ role legacy (cột users.role) = vai trò đầu tiên để menu/sidebar cũ vẫn hoạt động
    const primary = roles.find(role => role.id === uniq[0]);
    if (primary) await prisma.users.update({ where: { id: userId }, data: { role: primary.code } });
    const links = await prisma.role_permissions.findMany({
      where: { roleId: { in: uniq } },
      include: { permissions: true },
    });
    return {
      userId,
      roleCodes: roles.map(role => role.code),
      permissionCodes: [...new Set(links.map(link => link.permissions.code))],
    };
  },
};
