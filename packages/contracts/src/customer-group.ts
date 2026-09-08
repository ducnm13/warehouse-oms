import { z } from "zod";

export const customerGroupCreateSchema = z.object({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  parentId: z.coerce.number().int().positive().optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type CustomerGroupCreateInput = z.infer<typeof customerGroupCreateSchema>;

export const customerGroupUpdateSchema = customerGroupCreateSchema;
export type CustomerGroupUpdateInput = z.infer<typeof customerGroupUpdateSchema>;
