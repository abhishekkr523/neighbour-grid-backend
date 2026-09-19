"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const chat_service_1 = require("./chat.service");
const chatService = new chat_service_1.ChatService();
class ChatController {
    async getConversations(req, res) {
        try {
            const userId = req.user.userId;
            const conversations = await chatService.getConversations(userId);
            return res.status(200).json(conversations);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    async getConversation(req, res) {
        try {
            const { borrowerId, ownerId } = req.body;
            const conversation = await chatService.getConversation(borrowerId, ownerId);
            return res.status(200).json(conversation);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    async getMessages(req, res) {
        try {
            const id = req.params.id;
            const page = parseInt(req.query.page) || 1;
            const messages = await chatService.getMessages(id, page);
            return res.status(200).json(messages);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    async markAsRead(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user.userId;
            await chatService.markAsRead(id, userId);
            return res.status(200).json({ message: "Messages marked as read" });
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
}
exports.ChatController = ChatController;
