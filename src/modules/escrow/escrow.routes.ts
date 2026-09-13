import { Router } from "express";
import { EscrowController } from "./escrow.controller";
import { authenticate } from "../../middleware/authenticate";

const router = Router();
const escrowController = new EscrowController();

// All escrow routes require authentication
router.use(authenticate);

// POST /api/v1/reservations/:id/hold — Authorize escrow payment intent (FR-4.1)
router.post("/:id/hold", (req, res) => escrowController.createHold(req, res));

// POST /api/v1/reservations/:id/settle — Manual settlement
router.post("/:id/settle", (req, res) => escrowController.settle(req, res));

export default router;
