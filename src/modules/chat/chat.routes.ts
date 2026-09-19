import { Router } from "express";
import { ChatController } from "./chat.controller";
import { authenticate } from "../../middleware/authenticate";

const router = Router();
const chatController = new ChatController();

router.use(authenticate);

// GET /api/v1/chat/conversations
router.get("/conversations", (req, res) => chatController.getConversations(req, res));

// POST /api/v1/chat/conversations
router.post("/conversations", (req, res) => chatController.getConversation(req, res));

// GET /api/v1/chat/conversations/:id/messages
router.get("/conversations/:id/messages", (req, res) => chatController.getMessages(req, res));

// PUT /api/v1/chat/messages/:id/read (id here is actually conversationId to mark all as read)
router.put("/messages/:id/read", (req, res) => chatController.markAsRead(req, res));

export default router;
