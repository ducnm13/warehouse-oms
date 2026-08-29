import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { AuthTokenDto, AuthUserDto, LoginInput } from "@challenge/contracts";
import { HttpError } from "../../common/http-error";
import { authRepository } from "./auth.repository";

const ACCESS_SECONDS = 15 * 60;
const REFRESH_DAYS = Math.max(1, Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30));
const jwtSecret = () => {
  const value = process.env.JWT_SECRET;
  if (!value || value === "fallback_secret") throw new HttpError(500, "AUTH_CONFIG_ERROR", "JWT chưa được cấu hình an toàn");
  return value;
};
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const opaqueToken = () => randomBytes(48).toString("base64url");
const expiresAt = () => new Date(Date.now() + REFRESH_DAYS * 86400000);

const toUser = (user: { id: number; username: string | null; fullName: string | null; role: string | null }): AuthUserDto => ({
  id: user.id,
  username: user.username || "",
  fullName: user.fullName || "",
  role: user.role || "",
});

const accessToken = (user: AuthUserDto) => jwt.sign(
  { sub: user.id, id: user.id, username: user.username, role: user.role, type: "access" },
  jwtSecret(),
  { expiresIn: ACCESS_SECONDS } satisfies SignOptions,
);

export const authService = {
  async login(input: LoginInput, context: { ip?: string; userAgent?: string }): Promise<AuthTokenDto> {
    const record = await authRepository.findUserByUsername(input.username);
    if (!record?.password || !(await bcrypt.compare(input.password, record.password))) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Sai tài khoản hoặc mật khẩu");
    }
    const user = toUser(record);
    const refreshToken = opaqueToken();
    await authRepository.createRefreshToken({
      userId: user.id, tokenHash: hashToken(refreshToken), familyId: randomUUID(), expiresAt: expiresAt(),
      createdIp: context.ip, userAgent: context.userAgent,
    });
    return { accessToken: accessToken(user), refreshToken, expiresInSeconds: ACCESS_SECONDS, user };
  },

  async refresh(refreshToken: string, context: { ip?: string; userAgent?: string }): Promise<AuthTokenDto> {
    const currentHash = hashToken(refreshToken);
    const current = await authRepository.findRefreshToken(currentHash);
    if (!current) throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Refresh token không hợp lệ");
    if (current.revokedAt) {
      await authRepository.revokeFamily(current.userId, current.familyId);
      throw new HttpError(401, "REFRESH_TOKEN_REUSED", "Phiên đăng nhập đã bị thu hồi");
    }
    if (current.expiresAt.getTime() <= Date.now()) {
      await authRepository.revokeToken(currentHash);
      throw new HttpError(401, "REFRESH_TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn");
    }
    const user = toUser(current.users);
    const nextToken = opaqueToken();
    await authRepository.rotateRefreshToken(currentHash, {
      userId: user.id, tokenHash: hashToken(nextToken), familyId: current.familyId, expiresAt: expiresAt(),
      createdIp: context.ip, userAgent: context.userAgent,
    });
    return { accessToken: accessToken(user), refreshToken: nextToken, expiresInSeconds: ACCESS_SECONDS, user };
  },

  async logout(refreshToken: string) {
    await authRepository.revokeToken(hashToken(refreshToken));
  },
};