import { prisma } from "@challenge/database";
import type { ChatConversationCreateInput, ChatMessageCreateInput } from "@challenge/contracts";
import { HttpError } from "../../common/http-error";

const TYPING_MS = 8000;
const ONLINE_MS = 60000;

async function assertParticipant(conversationId: number, userId: number) {
  const link = await prisma.chat_participants.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!link) throw new HttpError(403, "CHAT_FORBIDDEN", "Bạn không thuộc cuộc trò chuyện này");
  return link;
}

function toMessage(row: any, meId: number) {
  const counts = new Map<string, { count: number; mine: boolean }>();
  for (const r of row.chat_reactions || []) {
    const slot = counts.get(r.emoji) || { count: 0, mine: false };
    slot.count += 1;
    if (r.userId === meId) slot.mine = true;
    counts.set(r.emoji, slot);
  }
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    senderName: row.users?.fullName || row.users?.username || "?",
    senderAvatar: row.users?.avatarUrl || null,
    body: row.body,
    replyTo: row.replyTo
      ? {
          id: row.replyTo.id,
          senderName: row.replyTo.users?.fullName || row.replyTo.users?.username || "?",
          body: row.replyTo.body,
        }
      : null,
    reactions: [...counts.entries()].map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine })),
    createdAt: row.createdAt,
  };
}

export const chatService = {
  async listConversations(userId: number) {
    const parts = await prisma.chat_participants.findMany({
      where: { userId },
      include: {
        chat_conversations: {
          include: {
            chat_participants: { include: { users: { select: { id: true, fullName: true, username: true, avatarUrl: true } } } },
            chat_messages: { orderBy: { id: "desc" }, take: 1 },
          },
        },
      },
    });
    const convos = [];
    for (const part of parts) {
      const conv = part.chat_conversations;
      const others = conv.chat_participants.filter(p => p.userId !== userId).map(p => p.users);
      const last = conv.chat_messages[0];
      const unread = await prisma.chat_messages.count({
        where: { conversationId: conv.id, id: { gt: part.lastReadMessageId }, senderId: { not: userId } },
      });
      const displayName = conv.isGroup
        ? conv.name || others.map(u => u.fullName || u.username).join(", ")
        : others[0]?.fullName || others[0]?.username || "Đoạn chat";
      convos.push({
        id: conv.id,
        name: displayName,
        isGroup: Boolean(conv.isGroup),
        avatarUrl: conv.isGroup ? null : others[0]?.avatarUrl || null,
        participants: others.map(u => ({ id: u.id, name: u.fullName || u.username, avatarUrl: u.avatarUrl || null })),
        lastMessage: last ? { id: last.id, body: last.body, senderId: last.senderId, createdAt: last.createdAt } : null,
        unread,
      });
    }
    convos.sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return tb - ta;
    });
    return convos;
  },

  async createConversation(userId: number, input: ChatConversationCreateInput) {
    const otherIds = [...new Set(input.userIds.map(Number).filter(id => id > 0 && id !== userId))];
    if (!otherIds.length) throw new HttpError(422, "CHAT_NO_PEER", "Chọn ít nhất một người để trò chuyện");
    const users = await prisma.users.findMany({ where: { id: { in: otherIds } }, select: { id: true } });
    if (users.length !== otherIds.length) throw new HttpError(422, "CHAT_USER_NOT_FOUND", "Người dùng không tồn tại");
    const isGroup = otherIds.length > 1 || Boolean(input.name && input.name.trim());
    // Tái dùng đoạn chat 1-1 đã có
    if (!isGroup) {
      const mine = await prisma.chat_participants.findMany({ where: { userId } });
      for (const part of mine) {
        const peers = await prisma.chat_participants.findMany({ where: { conversationId: part.conversationId } });
        if (peers.length === 2 && peers.some(p => p.userId === otherIds[0])) {
          const conv = await prisma.chat_conversations.findUnique({ where: { id: part.conversationId } });
          if (conv && !conv.isGroup) return { id: conv.id, reused: true };
        }
      }
    }
    const conv = await prisma.chat_conversations.create({
      data: {
        name: input.name?.trim() || null,
        isGroup,
        chat_participants: { create: [userId, ...otherIds].map(id => ({ userId: id, lastReadMessageId: 0 })) },
      },
    });
    return { id: conv.id, reused: false };
  },

  async listMessages(userId: number, conversationId: number, query: { after?: number; before?: number; limit?: number }) {
    await assertParticipant(conversationId, userId);
    const after = Number(query.after || 0);
    const limit = Math.min(100, Math.max(1, Number(query.limit || 50)));
    const where: any = { conversationId };
    if (query.before) where.id = { lt: Number(query.before) };
    else if (after) where.id = { gt: after };
    const rows = await prisma.chat_messages.findMany({
      where,
      orderBy: { id: query.before ? "desc" : "asc" },
      take: limit,
      include: {
        users: { select: { fullName: true, username: true, avatarUrl: true } },
        replyTo: { include: { users: { select: { fullName: true, username: true } } } },
        chat_reactions: true,
      },
    });
    const list = rows.map(row => toMessage(row, userId));
    if (query.before) list.reverse();
    return list;
  },

  async sendMessage(userId: number, conversationId: number, input: ChatMessageCreateInput) {
    await assertParticipant(conversationId, userId);
    if (input.replyToId) {
      const target = await prisma.chat_messages.findUnique({ where: { id: input.replyToId } });
      if (!target || target.conversationId !== conversationId)
        throw new HttpError(422, "CHAT_REPLY_INVALID", "Tin nhắn được trả lời không thuộc cuộc trò chuyện");
    }
    const row = await prisma.chat_messages.create({
      data: { conversationId, senderId: userId, body: input.body, replyToId: input.replyToId || null },
      include: {
        users: { select: { fullName: true, username: true, avatarUrl: true } },
        replyTo: { include: { users: { select: { fullName: true, username: true } } } },
        chat_reactions: true,
      },
    });
    await prisma.chat_participants.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadMessageId: row.id },
    });
    await prisma.chat_typing.deleteMany({ where: { conversationId, userId } });
    return toMessage(row, userId);
  },

  async toggleReaction(userId: number, messageId: number, emoji: string) {
    const msg = await prisma.chat_messages.findUnique({ where: { id: messageId } });
    if (!msg) throw new HttpError(404, "CHAT_MESSAGE_NOT_FOUND", "Không tìm thấy tin nhắn");
    await assertParticipant(msg.conversationId, userId);
    const clean = String(emoji || "").trim().slice(0, 16);
    if (!clean) throw new HttpError(422, "CHAT_EMOJI_INVALID", "Biểu tượng không hợp lệ");
    const existing = await prisma.chat_reactions.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji: clean } },
    });
    let added: boolean;
    if (existing) {
      await prisma.chat_reactions.delete({ where: { messageId_userId_emoji: { messageId, userId, emoji: clean } } });
      added = false;
    } else {
      await prisma.chat_reactions.create({ data: { messageId, userId, emoji: clean } });
      added = true;
    }
    const rows = await prisma.chat_reactions.findMany({ where: { messageId } });
    const counts = new Map<string, { count: number; mine: boolean }>();
    for (const r of rows) {
      const slot = counts.get(r.emoji) || { count: 0, mine: false };
      slot.count += 1;
      if (r.userId === userId) slot.mine = true;
      counts.set(r.emoji, slot);
    }
    return {
      added,
      conversationId: msg.conversationId,
      reactions: [...counts.entries()].map(([e, v]) => ({ emoji: e, count: v.count, mine: v.mine })),
    };
  },

  async heartbeat(userId: number, conversationId: number) {
    await assertParticipant(conversationId, userId);
    await prisma.chat_typing.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId },
      update: { updatedAt: new Date() },
    });
    return { success: true };
  },

  async presence(userId: number, conversationId: number) {
    await assertParticipant(conversationId, userId);
    const cutoffTyping = new Date(Date.now() - TYPING_MS);
    const cutoffOnline = new Date(Date.now() - ONLINE_MS);
    const rows = await prisma.chat_typing.findMany({
      where: { conversationId, userId: { not: userId }, updatedAt: { gte: cutoffOnline } },
      include: { users: { select: { id: true, fullName: true, username: true } } },
    });
    const map = (r: (typeof rows)[number]) => ({
      id: r.users.id,
      name: r.users.fullName || r.users.username,
    });
    return {
      typing: rows.filter(r => r.updatedAt >= cutoffTyping).map(map),
      online: rows.map(map),
    };
  },

  async updateConversation(
    userId: number,
    conversationId: number,
    input: { name?: string; addUserIds?: number[]; removeUserIds?: number[] },
  ) {
    await assertParticipant(conversationId, userId);
    const conv = await prisma.chat_conversations.findUnique({ where: { id: conversationId } });
    if (!conv) throw new HttpError(404, "CHAT_NOT_FOUND", "Không tìm thấy cuộc trò chuyện");
    const addIds = [...new Set((input.addUserIds || []).map(Number).filter(id => id > 0))];
    const removeIds = [...new Set((input.removeUserIds || []).map(Number).filter(id => id > 0))];
    if (!conv.isGroup && (addIds.length || removeIds.length))
      throw new HttpError(422, "CHAT_DIRECT_LOCKED", "Không thể thêm/bớt thành viên trong đoạn chat 1-1");
    if (input.name !== undefined && !conv.isGroup)
      throw new HttpError(422, "CHAT_DIRECT_LOCKED", "Không thể đổi tên đoạn chat 1-1");
    if (addIds.length) {
      const users = await prisma.users.findMany({ where: { id: { in: addIds } }, select: { id: true } });
      if (users.length !== addIds.length) throw new HttpError(422, "CHAT_USER_NOT_FOUND", "Người dùng không tồn tại");
      await prisma.chat_participants.createMany({
        data: addIds.map(id => ({ conversationId, userId: id, lastReadMessageId: 0 })),
        skipDuplicates: true,
      });
    }
    if (removeIds.length) {
      await prisma.chat_participants.deleteMany({ where: { conversationId, userId: { in: removeIds } } });
      await prisma.chat_typing.deleteMany({ where: { conversationId, userId: { in: removeIds } } });
    }
    if (input.name !== undefined && conv.isGroup) {
      await prisma.chat_conversations.update({ where: { id: conversationId }, data: { name: input.name.trim() || null } });
    }
    return { success: true };
  },

  async recallMessage(userId: number, conversationId: number, messageId: number) {
    await assertParticipant(conversationId, userId);
    const msg = await prisma.chat_messages.findUnique({ where: { id: messageId } });
    if (!msg || msg.conversationId !== conversationId)
      throw new HttpError(404, "CHAT_MESSAGE_NOT_FOUND", "Không tìm thấy tin nhắn");
    if (msg.senderId !== userId) throw new HttpError(403, "CHAT_RECALL_FORBIDDEN", "Chỉ thu hồi được tin nhắn của chính bạn");
    if (Date.now() - new Date(msg.createdAt).getTime() > 5 * 60 * 1000)
      throw new HttpError(403, "CHAT_RECALL_EXPIRED", "Chỉ thu hồi được trong 5 phút sau khi gửi");
    await prisma.chat_messages.delete({ where: { id: messageId } });
    return { success: true, id: messageId };
  },

  async markRead(userId: number, conversationId: number, lastMessageId: number) {
    await assertParticipant(conversationId, userId);
    const link = await prisma.chat_participants.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    const next = Math.max(link?.lastReadMessageId || 0, lastMessageId);
    await prisma.chat_participants.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadMessageId: next },
    });
    return { success: true, lastReadMessageId: next };
  },
};
