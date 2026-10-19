import { z } from "zod";

export const customerGroupCreateSchema = z.object({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  parentId: z.coerce.number().int().positive().optional().nullable(),
  priceBookId: z.coerce.number().int().positive().optional().nullable(),
  isTeam: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type CustomerGroupCreateInput = z.infer<typeof customerGroupCreateSchema>;

export const customerGroupUpdateSchema = z.object({
  code: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(255).optional(),
  parentId: z.coerce.number().int().positive().optional().nullable(),
  priceBookId: z.coerce.number().int().positive().optional().nullable(),
  isTeam: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).default(0).optional(),
  isActive: z.boolean().optional(),
});
export type CustomerGroupUpdateInput = z.infer<typeof customerGroupUpdateSchema>;
