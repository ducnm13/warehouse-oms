import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@challenge/database";
import { HttpError } from "./http-error";

type AccessPayload = { sub?: string | number; username?: string; role?: string; type?: string };

export const authenticateV1: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null;
    if (!token) throw new HttpError(401, "AUTH_REQUIRED", "Vui lòng đăng nhập");
    const payload = jwt.verify(token, process.env.JWT_SECRET || "") as AccessPayload;
    if (payload.type !== "access" || !payload.sub) throw new HttpError(401, "INVALID_ACCESS_TOKEN", "Access token không hợp lệ");
    const userId = Number(payload.sub);
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        user_roles: {
          include: { roles: { include: { role_permissions: { include: { permissions: true } } } } },
        },
      },
    });
    if (!user) throw new HttpError(401, "USER_NOT_FOUND", "Tài khoản không tồn tại");
    const roles = user.user_roles.map(item => item.roles.code);
    const permissions = [...new Set(user.user_roles.flatMap(item =>
      item.roles.role_permissions.map(link => link.permissions.code),
    ))];
    req.auth = {
      userId: user.id,
      username: user.username || "",
      legacyRole: user.role || "",
      roles,
      permissions,
    };
    next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    next(new HttpError(401, "INVALID_ACCESS_TOKEN", "Access token không hợp lệ hoặc đã hết hạn"));
  }
};

export const requirePermission = (permission: string): RequestHandler => (req, _res, next) => {
  if (req.auth?.permissions.includes("system.admin") || req.auth?.permissions.includes(permission)) return next();
  next(new HttpError(403, "PERMISSION_DENIED", "Bạn không có quyền thực hiện thao tác này"));
};