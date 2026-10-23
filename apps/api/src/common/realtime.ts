import type { Server as HttpServer } from "http";
import { Server as SocketServer, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "@challenge/database";

type AccessPayload = { sub?: string | number; id?: string | number };

let io: SocketServer | null = null;

export function attachRealtime(httpServer: HttpServer) {
  const origins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  io = new SocketServer(httpServer, {
    path: "/api/v1/socket.io",
    cors: { origin: origins, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = String(
        (socket.handshake.auth?.token as string) || (socket.handshake.query?.token as string) || "",
      );
      const payload = jwt.verify(token, process.env.JWT_SECRET || "") as AccessPayload;
      const userId = Number(payload.sub ?? payload.id);
      if (!userId) return next(new Error("INVALID_ACCESS_TOKEN"));
      socket.data.userId = userId;
      next();
    } catch {
      next(new Error("INVALID_ACCESS_TOKEN"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = Number(socket.data.userId);
    socket.join(`user:${userId}`);

    socket.on("chat:join", async (conversationId: number) => {
      try {
        const link = await prisma.chat_participants.findUnique({
          where: { conversationId_userId: { conversationId: Number(conversationId), userId } },
        });
        if (link) socket.join(`conversation:${Number(conversationId)}`);
      } catch {
        // bỏ qua
      }
    });

    socket.on("chat:leave", (conversationId: number) => {
      socket.leave(`conversation:${Number(conversationId)}`);
    });

    socket.on("chat:typing", async (conversationId: number) => {
      try {
        const link = await prisma.chat_participants.findUnique({
          where: { conversationId_userId: { conversationId: Number(conversationId), userId } },
        });
        if (!link) return;
        socket.to(`conversation:${Number(conversationId)}`).emit("chat:typing", {
          conversationId: Number(conversationId),
          userId,
        });
      } catch {
        // bỏ qua
      }
    });
  });

  return io;
}

async function participantUserIds(conversationId: number) {
  try {
    const rows = await prisma.chat_participants.findMany({
      where: { conversationId: Number(conversationId) },
      select: { userId: true },
    });
    return rows.map(row => row.userId);
  } catch {
    return [];
  }
}

function emitToUsers(room: string, event: string, payload: unknown) {
  if (!io) return;
  io.to(room).emit(event, payload);
}

export function emitDocumentChanged(payload: Record<string, unknown>) {
  io?.emit("document:changed", { ...payload, at: Date.now() });
}

export async function emitChatMessage(conversationId: number, message: unknown) {
  const ids = await participantUserIds(conversationId);
  const payload = { conversationId: Number(conversationId), message };
  for (const id of ids) emitToUsers(`user:${id}`, "chat:message", payload);
}

export async function emitChatConversationEvent(
  conversationId: number,
  event: "chat:reaction" | "chat:recall" | "chat:conversation",
  payload: unknown,
) {
  const ids = await participantUserIds(conversationId);
  for (const id of ids) emitToUsers(`user:${id}`, event, { conversationId: Number(conversationId), ...(payload as object) });
}

export function emitChatTyping(conversationId: number, userId: number) {
  io?.to(`conversation:${Number(conversationId)}`).emit("chat:typing", {
    conversationId: Number(conversationId),
    userId,
  });
}
