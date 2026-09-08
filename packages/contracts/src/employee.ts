import { z } from "zod";

export const employeeCreateSchema = z.object({
  code: z.string().trim().min(1).max(100),
  fullName: z.string().trim().min(1).max(255),
  jobTitle: z.string().trim().max(255).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  workUnit: z.string().trim().max(255).optional().nullable(),
  userId: z.coerce.number().int().positive().optional().nullable(),
});
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;

export const employeeUpdateSchema = employeeCreateSchema;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;

export const employeeListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().trim().max(200).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;
