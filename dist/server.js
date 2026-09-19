"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables first
dotenv_1.default.config();
// Route imports
const routes_1 = __importDefault(require("./modules/auth/routes"));
const tools_routes_1 = __importDefault(require("./modules/tools/tools.routes"));
const reservations_routes_1 = __importDefault(require("./modules/reservations/reservations.routes"));
const escrow_routes_1 = __importDefault(require("./modules/escrow/escrow.routes"));
const audits_routes_1 = __importDefault(require("./modules/audits/audits.routes"));
const disputes_routes_1 = __importDefault(require("./modules/disputes/disputes.routes"));
// Middleware imports
const authenticate_1 = require("./middleware/authenticate");
// Worker imports (start on boot)
require("./workers/reservation-expiry.worker");
require("./workers/escrow-settlement.worker");
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const chat_routes_1 = __importDefault(require("./modules/chat/chat.routes"));
const chat_socket_1 = require("./modules/chat/chat.socket");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: { origin: "http://localhost:4200", credentials: true },
});
// ─── GLOBAL MIDDLEWARE ───────────────────────────────────────
app.use((0, cors_1.default)({ origin: "http://localhost:4200", credentials: true }));
app.use(express_1.default.json({ limit: "10mb" }));
app.use((0, cookie_parser_1.default)());
// ─── HEALTH CHECK ────────────────────────────────────────────
app.get("/api/v1/health", (_req, res) => {
    res.json({
        status: "UP",
        service: "NeighborGrid Backend",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
    });
});
// ─── API ROUTES (v1) ────────────────────────────────────────
app.use("/api/v1/auth", routes_1.default);
app.use("/api/v1/tools", tools_routes_1.default);
app.use("/api/v1/reservations", reservations_routes_1.default);
app.use("/api/v1/reservations", escrow_routes_1.default); // Mounts :id/hold, :id/settle under /reservations
app.use("/api/v1/audits", audits_routes_1.default);
app.use("/api/v1/disputes", disputes_routes_1.default);
app.use("/api/v1/chat", chat_routes_1.default);
// ─── AUDIT RETRIEVAL (nested under reservations) ─────────────
// GET /api/v1/reservations/:id/audits
const audits_controller_1 = require("./modules/audits/audits.controller");
const auditsController = new audits_controller_1.AuditsController();
app.get("/api/v1/reservations/:id/audits", authenticate_1.authenticate, (req, res) => auditsController.getAudits(req, res));
// ─── AVAILABILITY (nested under tools) ───────────────────────
// GET /api/v1/tools/:toolId/availability
const reservations_controller_1 = require("./modules/reservations/reservations.controller");
const reservationsController = new reservations_controller_1.ReservationsController();
app.get("/api/v1/tools/:toolId/availability", authenticate_1.authenticate, (req, res) => reservationsController.getAvailability(req, res));
// ─── DISPUTE FILING (nested under reservations) ──────────────
// POST /api/v1/reservations/:id/dispute
const disputes_controller_1 = require("./modules/disputes/disputes.controller");
const disputesController = new disputes_controller_1.DisputesController();
app.post("/api/v1/reservations/:id/dispute", authenticate_1.authenticate, (req, res) => disputesController.fileDispute(req, res));
// ─── PROTECTED PROFILE ROUTE ────────────────────────────────
app.get("/api/v1/me", authenticate_1.authenticate, (req, res) => {
    res.json({ message: "Protected profile accessed", user: req.user });
});
// ─── GLOBAL ERROR HANDLER ───────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
});
// ─── 404 HANDLER ─────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
});
// ─── SOCKET.IO SETUP ─────────────────────────────────────────
(0, chat_socket_1.setupChatSockets)(io);
// ─── START SERVER ────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`🚀 NeighborGrid Backend running on http://localhost:${PORT}`);
    console.log(`📡 API Base: http://localhost:${PORT}/api/v1`);
    console.log(`🔄 BullMQ Workers: reservation-expiry, escrow-settlement`);
    console.log(`💬 WebSocket Server is running`);
});
