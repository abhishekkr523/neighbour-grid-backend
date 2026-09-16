"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisputesController = void 0;
const disputes_service_1 = require("./disputes.service");
const disputesService = new disputes_service_1.DisputesService();
class DisputesController {
    // POST /api/v1/reservations/:id/dispute — File dispute (owner only)
    async fileDispute(req, res) {
        try {
            const { reason, evidence_urls } = req.body;
            if (!reason) {
                return res
                    .status(400)
                    .json({ error: "reason is required to file a dispute" });
            }
            const dispute = await disputesService.fileDispute(req.user.userId, {
                reservation_id: req.params.id,
                reason,
                evidence_urls,
            });
            return res.status(201).json({
                message: "Dispute filed — deposit frozen pending admin review",
                dispute,
            });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
    // GET /api/v1/disputes/:id — Get dispute details (admin)
    async getDispute(req, res) {
        try {
            const result = await disputesService.getDisputeById(req.params.id);
            return res.status(200).json(result);
        }
        catch (error) {
            return res.status(404).json({ error: error.message });
        }
    }
    // GET /api/v1/disputes — List all disputes (admin)
    async listDisputes(req, res) {
        try {
            const status = req.query.status;
            const disputes = await disputesService.listDisputes(status);
            return res.status(200).json({ disputes });
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    // PATCH /api/v1/disputes/:id/resolve — Admin resolves dispute
    async resolveDispute(req, res) {
        try {
            const { resolution, admin_notes } = req.body;
            if (!resolution ||
                !["RESOLVED_OWNER", "RESOLVED_BORROWER"].includes(resolution)) {
                return res.status(400).json({
                    error: "resolution must be RESOLVED_OWNER or RESOLVED_BORROWER",
                });
            }
            const dispute = await disputesService.resolveDispute(req.params.id, req.user.userId, { resolution, admin_notes });
            return res
                .status(200)
                .json({ message: "Dispute resolved", dispute });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
}
exports.DisputesController = DisputesController;
