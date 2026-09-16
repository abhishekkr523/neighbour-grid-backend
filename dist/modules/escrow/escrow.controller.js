"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscrowController = void 0;
const escrow_service_1 = require("./escrow.service");
const escrowService = new escrow_service_1.EscrowService();
class EscrowController {
    // POST /api/v1/reservations/:id/hold — Authorize escrow payment
    async createHold(req, res) {
        try {
            const result = await escrowService.createPaymentHold(req.params.id, req.user.userId);
            return res.status(200).json({
                message: "Payment hold created successfully",
                ...result,
            });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
    // POST /api/v1/reservations/:id/settle — Manual settlement (admin/testing)
    async settle(req, res) {
        try {
            const result = await escrowService.settleEscrow(req.params.id);
            return res.status(200).json({
                message: "Escrow settled successfully",
                settlement: result,
            });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
}
exports.EscrowController = EscrowController;
