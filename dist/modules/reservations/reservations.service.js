"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationsService = void 0;
const db_1 = require("../../config/db");
const bullmq_1 = require("bullmq");
const redis_1 = require("../../config/redis");
// BullMQ queue for reservation auto-expiry (FR-3.4)
const reservationExpiryQueue = new bullmq_1.Queue("reservation-expiry", {
    connection: redis_1.redis,
});
class ReservationsService {
    // ─── FR-3.1 + FR-3.2 + FR-3.3: CREATE RESERVATION ────────
    async createReservation(borrowerId, dto) {
        const client = await db_1.pool.connect();
        try {
            await client.query("BEGIN");
            // Validate the tool exists and is active
            const toolResult = await client.query(`SELECT id, owner_id, price_per_day, security_deposit
         FROM tools WHERE id = $1 AND is_active = TRUE`, [dto.tool_id]);
            if (toolResult.rows.length === 0) {
                throw new Error("Tool not found or is not active");
            }
            const tool = toolResult.rows[0];
            // Prevent self-booking
            if (tool.owner_id === borrowerId) {
                throw new Error("You cannot reserve your own tool");
            }
            // Calculate total fee: days × daily rate
            const startDate = new Date(dto.start_date);
            const endDate = new Date(dto.end_date);
            if (endDate < startDate) {
                throw new Error("end_date must be after or equal to start_date");
            }
            const diffMs = endDate.getTime() - startDate.getTime();
            const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1; // inclusive
            const totalFeeCents = days * tool.price_per_day;
            const depositCents = tool.security_deposit;
            // Build daterange: [start_date, end_date] inclusive
            // PostgreSQL DATERANGE with '[]' bounds
            const bookingRange = `[${dto.start_date},${dto.end_date}]`;
            // Insert reservation — the EXCLUDE constraint (FR-3.3) will reject
            // overlapping bookings at the DB level, throwing a unique violation.
            const result = await client.query(`INSERT INTO reservations
           (tool_id, borrower_id, start_date, end_date, booking_range, status, total_fee_cents, deposit_cents)
         VALUES ($1, $2, $3, $4, $5::daterange, 'PENDING', $6, $7)
         RETURNING id, tool_id, borrower_id, start_date, end_date, status, total_fee_cents, deposit_cents, created_at`, [
                dto.tool_id,
                borrowerId,
                dto.start_date,
                dto.end_date,
                bookingRange,
                totalFeeCents,
                depositCents,
            ]);
            await client.query("COMMIT");
            const reservation = result.rows[0];
            // FR-3.4: Enqueue auto-cancel job — 24 hours delay
            await reservationExpiryQueue.add("auto-cancel", { reservationId: reservation.id }, { delay: 24 * 60 * 60 * 1000, attempts: 3, backoff: { type: "exponential", delay: 5000 } });
            return reservation;
        }
        catch (error) {
            await client.query("ROLLBACK");
            // FR-3.3: Detect exclusion constraint violation → 409
            if (error.code === "23P01") {
                const conflictError = new Error("The selected dates overlap with an existing booking");
                conflictError.statusCode = 409;
                throw conflictError;
            }
            throw error;
        }
        finally {
            client.release();
        }
    }
    // ─── OWNER ACCEPTS BOOKING ────────────────────────────────
    async acceptReservation(reservationId, ownerId) {
        const result = await db_1.pool.query(`UPDATE reservations r
       SET status = 'CONFIRMED', updated_at = NOW()
       FROM tools t
       WHERE r.id = $1
         AND r.tool_id = t.id
         AND t.owner_id = $2
         AND r.status = 'PENDING'
       RETURNING r.id, r.status, r.tool_id, r.borrower_id`, [reservationId, ownerId]);
        if (result.rows.length === 0) {
            throw new Error("Reservation not found, not owned by you, or not in PENDING status");
        }
        return result.rows[0];
    }
    // ─── OWNER DECLINES BOOKING ───────────────────────────────
    async declineReservation(reservationId, ownerId) {
        const result = await db_1.pool.query(`UPDATE reservations r
       SET status = 'CANCELLED', updated_at = NOW()
       FROM tools t
       WHERE r.id = $1
         AND r.tool_id = t.id
         AND t.owner_id = $2
         AND r.status = 'PENDING'
       RETURNING r.id, r.status`, [reservationId, ownerId]);
        if (result.rows.length === 0) {
            throw new Error("Reservation not found, not owned by you, or not in PENDING status");
        }
        return result.rows[0];
    }
    // ─── LIST RESERVATIONS FOR A USER ─────────────────────────
    async getReservationsByUser(userId, role) {
        let query;
        if (role === "borrower") {
            query = `
        SELECT r.*, t.title AS tool_title, t.owner_id
        FROM reservations r
        JOIN tools t ON t.id = r.tool_id
        WHERE r.borrower_id = $1
        ORDER BY r.created_at DESC`;
        }
        else {
            query = `
        SELECT r.*, t.title AS tool_title, u.name AS borrower_name
        FROM reservations r
        JOIN tools t ON t.id = r.tool_id
        JOIN users u ON u.id = r.borrower_id
        WHERE t.owner_id = $1
        ORDER BY r.created_at DESC`;
        }
        const result = await db_1.pool.query(query, [userId]);
        return result.rows;
    }
    // ─── GET SINGLE RESERVATION ───────────────────────────────
    async getReservationById(reservationId, userId) {
        const result = await db_1.pool.query(`SELECT r.*, t.title AS tool_title, t.owner_id,
              u_b.name AS borrower_name, u_o.name AS owner_name
       FROM reservations r
       JOIN tools t ON t.id = r.tool_id
       JOIN users u_b ON u_b.id = r.borrower_id
       JOIN users u_o ON u_o.id = t.owner_id
       WHERE r.id = $1
         AND (r.borrower_id = $2 OR t.owner_id = $2)`, [reservationId, userId]);
        if (result.rows.length === 0) {
            throw new Error("Reservation not found");
        }
        return result.rows[0];
    }
    // ─── GET UNAVAILABLE DATES FOR A TOOL (UI-3) ──────────────
    async getUnavailableDates(toolId) {
        const result = await db_1.pool.query(`SELECT start_date, end_date
       FROM reservations
       WHERE tool_id = $1
         AND status NOT IN ('CANCELLED', 'COMPLETED')
       ORDER BY start_date ASC`, [toolId]);
        return result.rows;
    }
    // ─── TRANSITION: ESCROWED → ACTIVE_IN_USE ─────────────────
    async activateReservation(reservationId) {
        const result = await db_1.pool.query(`UPDATE reservations
       SET status = 'ACTIVE_IN_USE', updated_at = NOW()
       WHERE id = $1 AND status = 'ESCROWED'
       RETURNING id, status`, [reservationId]);
        if (result.rows.length === 0) {
            throw new Error("Reservation not in ESCROWED status");
        }
        return result.rows[0];
    }
    // ─── TRANSITION: ACTIVE_IN_USE → RETURNED ─────────────────
    async markReturned(reservationId, userId) {
        const result = await db_1.pool.query(`UPDATE reservations r
       SET status = 'RETURNED', updated_at = NOW()
       FROM tools t
       WHERE r.id = $1
         AND r.tool_id = t.id
         AND (r.borrower_id = $2 OR t.owner_id = $2)
         AND r.status = 'ACTIVE_IN_USE'
       RETURNING r.id, r.status`, [reservationId, userId]);
        if (result.rows.length === 0) {
            throw new Error("Reservation not found or not in ACTIVE_IN_USE status");
        }
        return result.rows[0];
    }
}
exports.ReservationsService = ReservationsService;
