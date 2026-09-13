import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

// Load environment variables first
dotenv.config();

// Route imports
import authRoutes from "./modules/auth/routes";
import toolsRoutes from "./modules/tools/tools.routes";
import reservationsRoutes from "./modules/reservations/reservations.routes";
import escrowRoutes from "./modules/escrow/escrow.routes";
import auditsRoutes from "./modules/audits/audits.routes";
import disputesRoutes from "./modules/disputes/disputes.routes";

// Middleware imports
import { authenticate, AuthenticatedRequest } from "./middleware/authenticate";

// Worker imports (start on boot)
import "./workers/reservation-expiry.worker";
import "./workers/escrow-settlement.worker";

const app = express();
const PORT = process.env.PORT || 3000;

// ─── GLOBAL MIDDLEWARE ───────────────────────────────────────
app.use(cors({ origin: "http://localhost:4200", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// ─── HEALTH CHECK ────────────────────────────────────────────
app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.json({
    status: "UP",
    service: "NeighborGrid Backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ─── API ROUTES (v1) ────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/tools", toolsRoutes);
app.use("/api/v1/reservations", reservationsRoutes);
app.use("/api/v1/reservations", escrowRoutes);       // Mounts :id/hold, :id/settle under /reservations
app.use("/api/v1/audits", auditsRoutes);
app.use("/api/v1/disputes", disputesRoutes);

// ─── AUDIT RETRIEVAL (nested under reservations) ─────────────
// GET /api/v1/reservations/:id/audits
import { AuditsController } from "./modules/audits/audits.controller";
const auditsController = new AuditsController();
app.get(
  "/api/v1/reservations/:id/audits",
  authenticate,
  (req, res) => auditsController.getAudits(req, res)
);

// ─── AVAILABILITY (nested under tools) ───────────────────────
// GET /api/v1/tools/:toolId/availability
import { ReservationsController } from "./modules/reservations/reservations.controller";
const reservationsController = new ReservationsController();
app.get(
  "/api/v1/tools/:toolId/availability",
  authenticate,
  (req, res) => reservationsController.getAvailability(req, res)
);

// ─── DISPUTE FILING (nested under reservations) ──────────────
// POST /api/v1/reservations/:id/dispute
import { DisputesController } from "./modules/disputes/disputes.controller";
const disputesController = new DisputesController();
app.post(
  "/api/v1/reservations/:id/dispute",
  authenticate,
  (req, res) => disputesController.fileDispute(req, res)
);

// ─── PROTECTED PROFILE ROUTE ────────────────────────────────
app.get(
  "/api/v1/me",
  authenticate,
  (req: AuthenticatedRequest, res: Response) => {
    res.json({ message: "Protected profile accessed", user: req.user });
  }
);

// ─── GLOBAL ERROR HANDLER ───────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ─── 404 HANDLER ─────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── START SERVER ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 NeighborGrid Backend running on http://localhost:${PORT}`);
  console.log(`📡 API Base: http://localhost:${PORT}/api/v1`);
  console.log(`🔄 BullMQ Workers: reservation-expiry, escrow-settlement`);
});
