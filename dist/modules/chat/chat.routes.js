"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_controller_1 = require("./chat.controller");
const authenticate_1 = require("../../middleware/authenticate");
const router = (0, express_1.Router)();
const chatController = new chat_controller_1.ChatController();
router.use(authenticate_1.authenticate);
// GET /api/v1/chat/conversations
router.get("/conversations", (req, res) => chatController.getConversations(req, res));
// POST /api/v1/chat/conversations
router.post("/conversations", (req, res) => chatController.getConversation(req, res));
// GET /api/v1/chat/conversations/:id/messages
router.get("/conversations/:id/messages", (req, res) => chatController.getMessages(req, res));
// PUT /api/v1/chat/messages/:id/read (id here is actually conversationId to mark all as read)
router.put("/messages/:id/read", (req, res) => chatController.markAsRead(req, res));
exports.default = router;
