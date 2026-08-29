import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(3, "Tên đăng nhập tối thiểu 3 ký tự").max(255),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự").max(200),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(32, "Refresh token không hợp lệ"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

export interface AuthUserDto {
  id: number;
  username: string;
  fullName: string;
  role: string;
}

export interface AuthTokenDto {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: AuthUserDto;
}