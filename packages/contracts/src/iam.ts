import { z } from "zod";

// ─── Roles ────────────────────────────────────────────────────────────────
export const roleCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(30)
  .regex(/^[A-Z0-9_]+$/, "Mã vai trò chỉ gồm chữ hoa, số và gạch dưới");

export const roleCreateSchema = z.object({
  code: roleCodeSchema,
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional().default(""),
  permissionCodes: z.array(z.string().trim().min(1)).default([]),
});
export type RoleCreateInput = z.infer<typeof roleCreateSchema>;

export const roleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional().default(""),
  permissionCodes: z.array(z.string().trim().min(1)).default([]),
});
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;

// ─── User ↔ roles ─────────────────────────────────────────────────────────
export const userRolesAssignSchema = z.object({
  roleIds: z.array(z.coerce.number().int().positive()).min(1).max(20),
});
export type UserRolesAssignInput = z.infer<typeof userRolesAssignSchema>;
