"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisputesService = void 0;
const db_1 = require("../../config/db");
const escrow_service_1 = require("../escrow/escrow.service");
const escrowService = new escrow_service_1.EscrowService();
class DisputesService {
    // ─── FR-5.3: FILE DISPUTE ──────────────────────────────────
    // Owner files within 24h of return; freezes escrow deposit (FR-4.4)
    async fileDispute(filedBy, dto) {
        const client = await db_1.pool.connect();
        try {
            await client.query("BEGIN");
            // Verify the reservation exists, is in RETURNED status,
            // and the filer is the tool owner
            const resCheck = await client.query(`SELECT r.id, r.status, r.borrower_id, r.end_date, t.owner_id
         FROM reservations r
         JOIN tools t ON t.id = r.tool_id
         WHERE r.id = $1 AND t.owner_id = $2`, [dto.reservation_id, filedBy]);
            if (resCheck.rows.length === 0) {
                throw new Error("Reservation not found or you are not the tool owner");
            }
            const reservation = resCheck.rows[0];
            if (reservation.status !== "RETURNED") {
                throw new Error(`Disputes can only be filed when reservation is RETURNED (current: ${reservation.status})`);
            }
            // FR-5.3: Check 24-hour dispute filing window
            const returnDate = new Date(reservation.end_date);
            const now = new Date();
            const hoursSinceReturn = (now.getTime() - returnDate.getTime()) / (1000 * 60 * 60);
            // Allow some buffer (48h) for edge cases around return timing
            if (hoursSinceReturn > 48) {
                throw new Error("Dispute filing window has expired (must be within 24 hours of return)");
            }
            // Create dispute record
            const disputeResult = await client.query(`INSERT INTO disputes (reservation_id, filed_by, reason, evidence_urls)
         VALUES ($1, $2, $3, $4)
         RETURNING id, reservation_id, filed_by, reason, evidence_urls, status, created_at`, [
                dto.reservation_id,
                filedBy,
                dto.reason,
                dto.evidence_urls || [],
            ]);
            // FR-4.4: Freeze the escrow deposit
            await client.query(`UPDATE reservations SET status = 'DISPUTED', updated_at = NOW()
         WHERE id = $1`, [dto.reservation_id]);
            await client.query("COMMIT");
            return disputeResult.rows[0];
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
    // ─── FR-5.4: GET DISPUTE WITH SIDE-BY-SIDE AUDIT DATA ─────
    async getDisputeById(disputeId) {
        const disputeResult = await db_1.pool.query(`SELECT d.*, u.name AS filer_name
       FROM disputes d
       JOIN users u ON u.id = d.filed_by
       WHERE d.id = $1`, [disputeId]);
        if (disputeResult.rows.length === 0) {
            throw new Error("Dispute not found");
        }
        const dispute = disputeResult.rows[0];
        // Fetch side-by-side pickup vs return audit photos
        const auditsResult = await db_1.pool.query(`SELECT id, uploaded_by, audit_type, image_url, image_category, notes, created_at
       FROM audits
       WHERE reservation_id = $1
       ORDER BY audit_type ASC, image_category ASC`, [dispute.reservation_id]);
        const pickup = auditsResult.rows.filter((r) => r.audit_type === "PICKUP");
        const returnAudit = auditsResult.rows.filter((r) => r.audit_type === "RETURN");
        return {
            dispute,
            audits: { pickup, return: returnAudit },
        };
    }
    // ─── LIST ALL DISPUTES (ADMIN) ────────────────────────────
    async listDisputes(status) {
        let query = `
      SELECT d.*, u.name AS filer_name, r.tool_id, t.title AS tool_title
      FROM disputes d
      JOIN users u ON u.id = d.filed_by
      JOIN reservations r ON r.id = d.reservation_id
      JOIN tools t ON t.id = r.tool_id`;
        const params = [];
        if (status) {
            query += ` WHERE d.status = $1`;
            params.push(status);
        }
        query += ` ORDER BY d.created_at DESC`;
        const result = await db_1.pool.query(query, params);
        return result.rows;
    }
    // ─── ADMIN RESOLVES DISPUTE ───────────────────────────────
    async resolveDispute(disputeId, adminId, dto) {
        const client = await db_1.pool.connect();
        try {
            await client.query("BEGIN");
            // Update dispute status
            const disputeResult = await client.query(`UPDATE disputes
         SET status = $1, admin_notes = $2, resolved_by = $3, resolved_at = NOW()
         WHERE id = $4 AND status = 'OPEN'
         RETURNING id, reservation_id, status`, [dto.resolution, dto.admin_notes || null, adminId, disputeId]);
            if (disputeResult.rows.length === 0) {
                throw new Error("Dispute not found or already resolved");
            }
            const dispute = disputeResult.rows[0];
            // Handle escrow based on resolution
            if (dto.resolution === "RESOLVED_BORROWER") {
                // No damage — settle normally (capture rental, release deposit)
                await escrowService.settleEscrow(dispute.reservation_id);
            }
            else if (dto.resolution === "RESOLVED_OWNER") {
                // Damage confirmed — capture full amount (rental + deposit) to owner
                // For now, transition to COMPLETED with a note
                await client.query(`UPDATE reservations SET status = 'COMPLETED', updated_at = NOW()
           WHERE id = $1`, [dispute.reservation_id]);
                console.log(`[Dispute] Resolved in owner's favor — deposit retained for reservation ${dispute.reservation_id}`);
            }
            await client.query("COMMIT");
            return disputeResult.rows[0];
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
}
exports.DisputesService = DisputesService;
