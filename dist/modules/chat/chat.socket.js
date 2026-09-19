"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupChatSockets = setupChatSockets;
const chat_service_1 = require("./chat.service");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const chatService = new chat_service_1.ChatService();
function setupChatSockets(io) {
    // Middleware for authentication
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];
        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "default_secret");
            socket.user = decoded; // { userId, role }
            next();
        }
        catch (err) {
            return next(new Error("Authentication error: Invalid token"));
        }
    });
    io.on("connection", (socket) => {
        const user = socket.user;
        console.log(`Socket connected: ${socket.id} (User: ${user.userId})`);
        socket.on("join_conversation", (conversationId) => {
            // Basic authorization check could be added here
            socket.join(conversationId);
            console.log(`User ${user.userId} joined conversation ${conversationId}`);
        });
        socket.on("send_message", async (data) => {
            try {
                const savedMsg = await chatService.saveMessage(data.conversationId, user.userId, data.message);
                // Broadcast to the conversation room
                io.to(data.conversationId).emit("new_message", savedMsg);
            }
            catch (error) {
                console.error("Error sending message", error);
                socket.emit("error", { message: "Failed to send message" });
            }
        });
        socket.on("typing_started", (conversationId) => {
            socket.to(conversationId).emit("user_typing_started", { userId: user.userId, conversationId });
        });
        socket.on("typing_stopped", (conversationId) => {
            socket.to(conversationId).emit("user_typing_stopped", { userId: user.userId, conversationId });
        });
        socket.on("mark_as_read", async (conversationId) => {
            try {
                await chatService.markAsRead(conversationId, user.userId);
                socket.to(conversationId).emit("messages_read", { conversationId, readBy: user.userId });
            }
            catch (error) {
                console.error("Error marking messages as read", error);
            }
        });
        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${socket.id} (User: ${user.userId})`);
            // Could broadcast user_offline if global presence is needed
        });
    });
}
