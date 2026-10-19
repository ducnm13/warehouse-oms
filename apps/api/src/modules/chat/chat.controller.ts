import { chatService } from "./chat.service";

const me = (req: any) => req.auth!.userId as number;

export const chatController = {
  async listConversations(req: any, res: any) {
    res.json({ success: true, message: "OK", data: await chatService.listConversations(me(req)) });
  },
  async createConversation(req: any, res: any) {
    res.status(201).json({ success: true, message: "Đã tạo cuộc trò chuyện", data: await chatService.createConversation(me(req), req.body) });
  },
  async listMessages(req: any, res: any) {
    res.json({
      success: true,
      message: "OK",
      data: await chatService.listMessages(me(req), Number(req.params.id), req.query as any),
    });
  },
  async sendMessage(req: any, res: any) {
    res.status(201).json({
      success: true,
      message: "Đã gửi tin nhắn",
      data: await chatService.sendMessage(me(req), Number(req.params.id), req.body),
    });
  },
  async toggleReaction(req: any, res: any) {
    const messageId = Number(req.params.messageId);
    if (!Number.isInteger(messageId) || messageId <= 0)
      return res.status(422).json({ success: false, message: "Tin nhắn không hợp lệ", code: "VALIDATION_ERROR", data: null });
    res.json({
      success: true,
      message: "OK",
      data: await chatService.toggleReaction(me(req), messageId, String(req.body.emoji || "")),
    });
  },
  async heartbeat(req: any, res: any) {
    res.json({ success: true, message: "OK", data: await chatService.heartbeat(me(req), Number(req.params.id)) });
  },
  async presence(req: any, res: any) {
    res.json({ success: true, message: "OK", data: await chatService.presence(me(req), Number(req.params.id)) });
  },
  async updateConversation(req: any, res: any) {
    res.json({
      success: true,
      message: "Đã cập nhật cuộc trò chuyện",
      data: await chatService.updateConversation(me(req), Number(req.params.id), req.body),
    });
  },
  async recallMessage(req: any, res: any) {
    const messageId = Number(req.params.messageId);
    if (!Number.isInteger(messageId) || messageId <= 0)
      return res.status(422).json({ success: false, message: "Tin nhắn không hợp lệ", code: "VALIDATION_ERROR", data: null });
    res.json({
      success: true,
      message: "Đã thu hồi tin nhắn",
      data: await chatService.recallMessage(me(req), Number(req.params.id), messageId),
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
