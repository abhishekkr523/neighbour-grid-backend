"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const escrow_controller_1 = require("./escrow.controller");
const authenticate_1 = require("../../middleware/authenticate");
const router = (0, express_1.Router)();
const escrowController = new escrow_controller_1.EscrowController();
// All escrow routes require authentication
router.use(authenticate_1.authenticate);
// POST /api/v1/reservations/:id/hold — Authorize escrow payment intent (FR-4.1)
router.post("/:id/hold", (req, res) => escrowController.createHold(req, res));
// POST /api/v1/reservations/:id/settle — Manual settlement
router.post("/:id/settle", (req, res) => escrowController.settle(req, res));
exports.default = router;
