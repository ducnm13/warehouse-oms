import { z } from "zod";

// ─── Chat nội bộ ──────────────────────────────────────────────────────────
export const chatConversationCreateSchema = z.object({
  name: z.string().trim().max(255).optional().default(""),
  userIds: z.array(z.coerce.number().int().positive()).min(1).max(50),
});
export type ChatConversationCreateInput = z.infer<typeof chatConversationCreateSchema>;

export const chatMessageCreateSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  replyToId: z.coerce.number().int().positive().optional(),
});
export type ChatMessageCreateInput = z.infer<typeof chatMessageCreateSchema>;

export const chatReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
});
export type ChatReactionInput = z.infer<typeof chatReactionSchema>;

export const chatMessagesQuerySchema = z.object({
  after: z.coerce.number().int().min(0).default(0),
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ChatMessagesQuery = z.infer<typeof chatMessagesQuerySchema>;

export const chatReadSchema = z.object({
  lastMessageId: z.coerce.number().int().min(0),
});
export type ChatReadInput = z.infer<typeof chatReadSchema>;

export const chatConversationUpdateSchema = z.object({
  name: z.string().trim().max(255).optional(),
  addUserIds: z.array(z.coerce.number().int().positive()).max(50).optional().default([]),
  removeUserIds: z.array(z.coerce.number().int().positive()).max(50).optional().default([]),
});
export type ChatConversationUpdateInput = z.infer<typeof chatConversationUpdateSchema>;
