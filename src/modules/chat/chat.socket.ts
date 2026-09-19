import { Server, Socket } from "socket.io";
import { ChatService } from "./chat.service";
import jwt from "jsonwebtoken";

const chatService = new ChatService();

export function setupChatSockets(io: Server) {
  // Middleware for authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret") as any;
      (socket as any).user = decoded; // { userId, role }
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`Socket connected: ${socket.id} (User: ${user.userId})`);

    socket.on("join_conversation", (conversationId: string) => {
      // Basic authorization check could be added here
      socket.join(conversationId);
      console.log(`User ${user.userId} joined conversation ${conversationId}`);
    });

    socket.on("send_message", async (data: { conversationId: string; message: string }) => {
      try {
        const savedMsg = await chatService.saveMessage(data.conversationId, user.userId, data.message);
        // Broadcast to the conversation room
        io.to(data.conversationId).emit("new_message", savedMsg);
      } catch (error) {
        console.error("Error sending message", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("typing_started", (conversationId: string) => {
      socket.to(conversationId).emit("user_typing_started", { userId: user.userId, conversationId });
    });

    socket.on("typing_stopped", (conversationId: string) => {
      socket.to(conversationId).emit("user_typing_stopped", { userId: user.userId, conversationId });
    });

    socket.on("mark_as_read", async (conversationId: string) => {
      try {
        await chatService.markAsRead(conversationId, user.userId);
        socket.to(conversationId).emit("messages_read", { conversationId, readBy: user.userId });
      } catch (error) {
        console.error("Error marking messages as read", error);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id} (User: ${user.userId})`);
      // Could broadcast user_offline if global presence is needed
    });
  });
}
