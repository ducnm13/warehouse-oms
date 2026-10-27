import { Router } from "express";
import {
  chatConversationCreateSchema,
  chatConversationUpdateSchema,
  chatMessageCreateSchema,
  chatMessagesQuerySchema,
  chatReactionSchema,
  chatReadSchema,
  numericIdParamsSchema,
} from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { authenticateV1, requirePermission } from "../../common/authenticate";
import { validateBody, validateParams, validateQuery } from "../../common/validate";
import { chatController } from "./chat.controller";

export const chatRouter = Router();
chatRouter.use(authenticateV1, requirePermission("chat.use"));

chatRouter.get("/conversations", asyncHandler(chatController.listConversations));
chatRouter.post("/conversations", validateBody(chatConversationCreateSchema), asyncHandler(chatController.createConversation));
chatRouter.patch(
  "/conversations/:id",
  validateParams(numericIdParamsSchema),
  validateBody(chatConversationUpdateSchema),
  asyncHandler(chatController.updateConversation),
);
chatRouter.get(
  "/conversations/:id/messages",
  validateParams(numericIdParamsSchema),
  validateQuery(chatMessagesQuerySchema),
  asyncHandler(chatController.listMessages),
);
chatRouter.post(
  "/conversations/:id/messages",
  validateParams(numericIdParamsSchema),
  validateBody(chatMessageCreateSchema),
  asyncHandler(chatController.sendMessage),
);
chatRouter.post(
  "/conversations/:id/read",
  validateParams(numericIdParamsSchema),
  validateBody(chatReadSchema),
  asyncHandler(chatController.markRead),
);
chatRouter.post(
  "/conversations/:id/typing",
  validateParams(numericIdParamsSchema),
  asyncHandler(chatController.heartbeat),
);
chatRouter.get(
  "/conversations/:id/presence",
  validateParams(numericIdParamsSchema),
  asyncHandler(chatController.presence),
);
chatRouter.post(
  "/messages/:messageId/reactions",
  validateBody(chatReactionSchema),
  asyncHandler(chatController.toggleReaction),
);
chatRouter.delete(
  "/conversations/:id/messages/:messageId",
  validateParams(numericIdParamsSchema),
  asyncHandler(chatController.recallMessage),
);
