"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditsController = void 0;
const audits_service_1 = require("./audits.service");
const reservations_service_1 = require("../reservations/reservations.service");
const escrow_service_1 = require("../escrow/escrow.service");
const auditsService = new audits_service_1.AuditsService();
const reservationsService = new reservations_service_1.ReservationsService();
const escrowService = new escrow_service_1.EscrowService();
class AuditsController {
    // POST /api/v1/audits — Upload audit image
    async createAudit(req, res) {
        try {
            const { reservation_id, audit_type, image_url, image_category, notes } = req.body;
            if (!reservation_id || !audit_type || !image_url || !image_category) {
                return res.status(400).json({
                    error: "reservation_id, audit_type, image_url, and image_category are required",
                });
            }
            const validTypes = ["PICKUP", "RETURN"];
            const validCategories = ["OVERVIEW", "WEAR_POINTS", "SERIAL_NUMBER"];
            if (!validTypes.includes(audit_type)) {
                return res
                    .status(400)
                    .json({ error: `audit_type must be one of: ${validTypes.join(", ")}` });
            }
            if (!validCategories.includes(image_category)) {
                return res.status(400).json({
                    error: `image_category must be one of: ${validCategories.join(", ")}`,
                });
            }
            const audit = await auditsService.createAudit(req.user.userId, {
                reservation_id,
                audit_type,
                image_url,
                image_category,
                notes,
            });
            // Check if pickup audit is now complete — if so, auto-transition to ACTIVE_IN_USE
            if (audit_type === "PICKUP") {
                const isComplete = await auditsService.validatePickupComplete(reservation_id);
                if (isComplete) {
                    try {
                        await reservationsService.activateReservation(reservation_id);
                        return res.status(201).json({
                            message: "Audit uploaded. Pickup complete — reservation is now ACTIVE_IN_USE",
                            audit,
                            reservationActivated: true,
                        });
                    }
                    catch {
                        // Activation may fail if already activated; continue normally
                    }
                }
            }
            // Check if return audit is now complete — enqueue auto-settlement
            if (audit_type === "RETURN") {
                const isComplete = await auditsService.validateReturnComplete(reservation_id);
                if (isComplete) {
                    await escrowService.enqueueAutoSettlement(reservation_id);
                    return res.status(201).json({
                        message: "Audit uploaded. Return documentation complete — settlement enqueued (24h)",
                        audit,
                        returnComplete: true,
                    });
                }
            }
            return res.status(201).json({ message: "Audit uploaded", audit });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
    // GET /api/v1/reservations/:id/audits — Get audits for a reservation
    async getAudits(req, res) {
        try {
            const audits = await auditsService.getAuditsByReservation(req.params.id, req.user.userId);
            return res.status(200).json({ audits });
        }
        catch (error) {
            return res.status(403).json({ error: error.message });
        }
    }
    // POST /api/v1/audits/presign — Generate presigned upload URL
    async getPresignedUrl(req, res) {
        try {
            const { reservation_id, filename } = req.body;
            if (!reservation_id || !filename) {
                return res
                    .status(400)
                    .json({ error: "reservation_id and filename are required" });
            }
            const urls = auditsService.generatePresignedUploadUrl(reservation_id, filename);
            return res.status(200).json(urls);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
}
exports.AuditsController = AuditsController;
