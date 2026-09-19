import { Request, Response } from "express";
import { ChatService } from "./chat.service";
import { AuthenticatedRequest } from "../../middleware/authenticate";

const chatService = new ChatService();

export class ChatController {
  async getConversations(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const conversations = await chatService.getConversations(userId);
      return res.status(200).json(conversations);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getConversation(req: AuthenticatedRequest, res: Response) {
    try {
      const { borrowerId, ownerId } = req.body;
      const conversation = await chatService.getConversation(borrowerId, ownerId);
      return res.status(200).json(conversation);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getMessages(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const page = parseInt(req.query.page as string) || 1;
      const messages = await chatService.getMessages(id, page);
      return res.status(200).json(messages);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user!.userId;
      await chatService.markAsRead(id, userId);
      return res.status(200).json({ message: "Messages marked as read" });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
