import { chatService } from "./chat.service";
import { emitChatConversationEvent, emitChatMessage, emitChatTyping } from "../../common/realtime";

const me = (req: any) => req.auth!.userId as number;

export const chatController = {
  async listConversations(req: any, res: any) {
    res.json({ success: true, message: "OK", data: await chatService.listConversations(me(req)) });
  },
  async createConversation(req: any, res: any) {
    const data = await chatService.createConversation(me(req), req.body);
    void emitChatConversationEvent(data.id, "chat:conversation", { created: true });
    res.status(201).json({ success: true, message: "Đã tạo cuộc trò chuyện", data });
  },
  async listMessages(req: any, res: any) {
    res.json({
      success: true,
      message: "OK",
      data: await chatService.listMessages(me(req), Number(req.params.id), req.query as any),
    });
  },
  async sendMessage(req: any, res: any) {
    const conversationId = Number(req.params.id);
    const data = await chatService.sendMessage(me(req), conversationId, req.body);
    void emitChatMessage(conversationId, data);
    res.status(201).json({
      success: true,
      message: "Đã gửi tin nhắn",
      data,
    });
  },
  async toggleReaction(req: any, res: any) {
    const messageId = Number(req.params.messageId);
    if (!Number.isInteger(messageId) || messageId <= 0)
      return res.status(422).json({ success: false, message: "Tin nhắn không hợp lệ", code: "VALIDATION_ERROR", data: null });
    const data = await chatService.toggleReaction(me(req), messageId, String(req.body.emoji || ""));
    void emitChatConversationEvent(data.conversationId, "chat:reaction", { messageId, ...data });
    res.json({
      success: true,
      message: "OK",
      data,
    });
  },
  async heartbeat(req: any, res: any) {
    const conversationId = Number(req.params.id);
    const data = await chatService.heartbeat(me(req), conversationId);
    emitChatTyping(conversationId, me(req));
    res.json({ success: true, message: "OK", data });
  },
  async presence(req: any, res: any) {
    res.json({ success: true, message: "OK", data: await chatService.presence(me(req), Number(req.params.id)) });
  },
  async updateConversation(req: any, res: any) {
    const data = await chatService.updateConversation(me(req), Number(req.params.id), req.body);
    void emitChatConversationEvent(Number(req.params.id), "chat:conversation", { updated: true });
    res.json({
      success: true,
      message: "Đã cập nhật cuộc trò chuyện",
      data,
    });
  },
  async recallMessage(req: any, res: any) {
    const messageId = Number(req.params.messageId);
    if (!Number.isInteger(messageId) || messageId <= 0)
      return res.status(422).json({ success: false, message: "Tin nhắn không hợp lệ", code: "VALIDATION_ERROR", data: null });
    const data = await chatService.recallMessage(me(req), Number(req.params.id), messageId);
    void emitChatConversationEvent(Number(req.params.id), "chat:recall", { messageId });
    res.json({
      success: true,
      message: "Đã thu hồi tin nhắn",
      data,
    });
  },
  async markRead(req: any, res: any) {
    res.json({
      success: true,
      message: "OK",
      data: await chatService.markRead(me(req), Number(req.params.id), Number(req.body.lastMessageId || 0)),
    });
  },
};
