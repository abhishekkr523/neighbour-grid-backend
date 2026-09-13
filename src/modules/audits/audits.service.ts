import { pool } from "../../config/db";
import {
  CreateAuditDto,
  AuditType,
  REQUIRED_IMAGE_CATEGORIES,
} from "./audits.types";

export class AuditsService {
  // ─── CREATE AUDIT RECORD ───────────────────────────────────
  async createAudit(uploadedBy: string, dto: CreateAuditDto) {
    // Validate the reservation exists and user is a participant
    const resCheck = await pool.query(
      `SELECT r.id, r.status, r.borrower_id, t.owner_id
       FROM reservations r
       JOIN tools t ON t.id = r.tool_id
       WHERE r.id = $1
         AND (r.borrower_id = $2 OR t.owner_id = $2)`,
      [dto.reservation_id, uploadedBy]
    );

    if (resCheck.rows.length === 0) {
      throw new Error("Reservation not found or you are not a participant");
    }

    const reservation = resCheck.rows[0];

    // Validate audit type vs reservation status
    if (dto.audit_type === "PICKUP" && reservation.status !== "ESCROWED") {
      throw new Error(
        "Pickup audits can only be submitted when reservation is in ESCROWED status"
      );
    }
    if (
      dto.audit_type === "RETURN" &&
      reservation.status !== "ACTIVE_IN_USE"
    ) {
      throw new Error(
        "Return audits can only be submitted when reservation is ACTIVE_IN_USE"
      );
    }

    const result = await pool.query(
      `INSERT INTO audits (reservation_id, uploaded_by, audit_type, image_url, image_category, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, reservation_id, uploaded_by, audit_type, image_url, image_category, notes, created_at`,
      [
        dto.reservation_id,
        uploadedBy,
        dto.audit_type,
        dto.image_url,
        dto.image_category,
        dto.notes || null,
      ]
    );

    return result.rows[0];
  }

  // ─── GET AUDITS BY RESERVATION ─────────────────────────────
  // Returns pickup and return photos grouped (FR-5.4)
  async getAuditsByReservation(reservationId: string, userId: string) {
    // Verify user is a participant or admin
    const resCheck = await pool.query(
      `SELECT r.id, r.borrower_id, t.owner_id
       FROM reservations r
       JOIN tools t ON t.id = r.tool_id
       WHERE r.id = $1
         AND (r.borrower_id = $2 OR t.owner_id = $2)`,
      [reservationId, userId]
    );

    // Also allow admins
    if (resCheck.rows.length === 0) {
      const adminCheck = await pool.query(
        `SELECT id FROM users WHERE id = $1 AND role = 'ADMIN'`,
        [userId]
      );
      if (adminCheck.rows.length === 0) {
        throw new Error("Not authorized to view these audits");
      }
    }

    const result = await pool.query(
      `SELECT id, reservation_id, uploaded_by, audit_type, image_url, image_category, notes, created_at
       FROM audits
       WHERE reservation_id = $1
       ORDER BY audit_type ASC, created_at ASC`,
      [reservationId]
    );

    // Group by audit_type
    const pickup = result.rows.filter(
      (r: any) => r.audit_type === "PICKUP"
    );
    const returnAudit = result.rows.filter(
      (r: any) => r.audit_type === "RETURN"
    );

    return { pickup, return: returnAudit };
  }

  // ─── FR-5.1: VALIDATE PICKUP AUDIT COMPLETE ───────────────
  // Check that at least 3 images (one per required category) exist
  async validatePickupComplete(reservationId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT DISTINCT image_category
       FROM audits
       WHERE reservation_id = $1 AND audit_type = 'PICKUP'`,
      [reservationId]
    );

    const uploadedCategories = result.rows.map(
      (r: any) => r.image_category
    );

    return REQUIRED_IMAGE_CATEGORIES.every((cat) =>
      uploadedCategories.includes(cat)
    );
  }

  // ─── VALIDATE RETURN AUDIT COMPLETE ────────────────────────
  async validateReturnComplete(reservationId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT DISTINCT image_category
       FROM audits
       WHERE reservation_id = $1 AND audit_type = 'RETURN'`,
      [reservationId]
    );

    const uploadedCategories = result.rows.map(
      (r: any) => r.image_category
    );

    return REQUIRED_IMAGE_CATEGORIES.every((cat) =>
      uploadedCategories.includes(cat)
    );
  }

  // ─── GENERATE PRESIGNED UPLOAD URL (STUB) ──────────────────
  // NFR-2.3: In production, generates short-lived S3 presigned URL (TTL ≤ 10 min)
  generatePresignedUploadUrl(
    reservationId: string,
    filename: string
  ): { uploadUrl: string; publicUrl: string } {
    const bucket = process.env.S3_BUCKET || "neighborgrid-audits";
    const key = `audits/${reservationId}/${Date.now()}_${filename}`;

    // Stub: return placeholder URLs
    return {
      uploadUrl: `https://${bucket}.s3.amazonaws.com/${key}?X-Amz-Expires=600`,
      publicUrl: `https://${bucket}.s3.amazonaws.com/${key}`,
    };
  }
}
