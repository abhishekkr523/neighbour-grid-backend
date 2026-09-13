import { pool } from "../../config/db";
import { Queue } from "bullmq";
import { redis } from "../../config/redis";
import { StripePaymentIntent, EscrowSettlementResult } from "./escrow.types";

const PLATFORM_COMMISSION_RATE = parseFloat(
  process.env.PLATFORM_COMMISSION_RATE || "0.10"
);

// BullMQ queue for auto-settlement after return (FR-4.3)
const escrowSettlementQueue = new Queue("escrow-settlement", {
  connection: redis,
});

// ─── STRIPE STUB SERVICE ─────────────────────────────────────
// In production, replace these stubs with real Stripe SDK calls.
// The interfaces are designed so real integration is a drop-in.
class StripeStub {
  // FR-4.2: Create payment intent with manual capture
  async createPaymentIntent(
    amountCents: number,
    _currency: string = "usd"
  ): Promise<StripePaymentIntent> {
    const intentId = `pi_stub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    console.log(
      `[Stripe Stub] Created PaymentIntent ${intentId} for ${amountCents} cents (capture_method: manual)`
    );
    return {
      id: intentId,
      status: "requires_capture",
      amount: amountCents,
      capture_method: "manual",
    };
  }

  // Capture a held payment intent
  async capturePaymentIntent(
    intentId: string,
    amountToCapture: number
  ): Promise<StripePaymentIntent> {
    console.log(
      `[Stripe Stub] Captured ${amountToCapture} cents on ${intentId}`
    );
    return {
      id: intentId,
      status: "succeeded",
      amount: amountToCapture,
      capture_method: "manual",
    };
  }

  // Cancel (release) a payment intent hold
  async cancelPaymentIntent(
    intentId: string
  ): Promise<StripePaymentIntent> {
    console.log(`[Stripe Stub] Cancelled/released hold on ${intentId}`);
    return {
      id: intentId,
      status: "canceled",
      amount: 0,
      capture_method: "manual",
    };
  }
}

const stripe = new StripeStub();

export class EscrowService {
  // ─── FR-4.1 + FR-4.2: CREATE PAYMENT HOLD ─────────────────
  async createPaymentHold(reservationId: string, userId: string) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Fetch reservation (must be CONFIRMED and belong to borrower)
      const resResult = await client.query(
        `SELECT r.id, r.status, r.total_fee_cents, r.deposit_cents, r.borrower_id
         FROM reservations r
         WHERE r.id = $1 AND r.borrower_id = $2`,
        [reservationId, userId]
      );

      if (resResult.rows.length === 0) {
        throw new Error("Reservation not found or not your booking");
      }

      const reservation = resResult.rows[0];

      if (reservation.status !== "CONFIRMED") {
        throw new Error(
          `Reservation must be in CONFIRMED status (current: ${reservation.status})`
        );
      }

      // Total hold = rental fee + security deposit
      const totalHoldAmount =
        reservation.total_fee_cents + reservation.deposit_cents;

      // Create Stripe payment intent with manual capture (FR-4.2)
      const intent = await stripe.createPaymentIntent(totalHoldAmount);

      // Update reservation to ESCROWED
      await client.query(
        `UPDATE reservations
         SET status = 'ESCROWED', stripe_payment_intent_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [intent.id, reservationId]
      );

      await client.query("COMMIT");

      return {
        reservationId,
        status: "ESCROWED",
        paymentIntent: {
          id: intent.id,
          status: intent.status,
          amount: intent.amount,
          capture_method: intent.capture_method,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ─── FR-4.3: SETTLE ESCROW (rental capture + deposit release) ─
  async settleEscrow(
    reservationId: string
  ): Promise<EscrowSettlementResult> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const resResult = await client.query(
        `SELECT id, status, total_fee_cents, deposit_cents, stripe_payment_intent_id
         FROM reservations WHERE id = $1`,
        [reservationId]
      );

      if (resResult.rows.length === 0) {
        throw new Error("Reservation not found");
      }

      const reservation = resResult.rows[0];

      if (reservation.status !== "RETURNED") {
        throw new Error(
          `Reservation must be in RETURNED status for settlement (current: ${reservation.status})`
        );
      }

      const rentalFee = reservation.total_fee_cents;
      const deposit = reservation.deposit_cents;
      const commission = Math.round(rentalFee * PLATFORM_COMMISSION_RATE);
      const ownerPayout = rentalFee - commission;

      // Capture rental fee from the held payment intent
      await stripe.capturePaymentIntent(
        reservation.stripe_payment_intent_id,
        rentalFee
      );

      // Release security deposit hold
      // (In real Stripe, you'd handle this with separate intents or partial capture)
      console.log(
        `[Escrow] Releasing deposit of ${deposit} cents for reservation ${reservationId}`
      );

      // Transition to COMPLETED
      await client.query(
        `UPDATE reservations SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
        [reservationId]
      );

      await client.query("COMMIT");

      return {
        rentalFeeCaptured: rentalFee,
        depositReleased: deposit,
        platformCommission: commission,
        ownerPayout,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ─── FR-4.4: FREEZE DEPOSIT (dispute lock) ────────────────
  async freezeDeposit(reservationId: string) {
    const result = await pool.query(
      `UPDATE reservations SET status = 'DISPUTED', updated_at = NOW()
       WHERE id = $1 AND status = 'RETURNED'
       RETURNING id, status`,
      [reservationId]
    );

    if (result.rows.length === 0) {
      throw new Error("Reservation not in RETURNED status");
    }

    console.log(
      `[Escrow] Deposit frozen for reservation ${reservationId} — awaiting admin resolution`
    );

    return result.rows[0];
  }

  // ─── ENQUEUE AUTO-SETTLEMENT (24h after return) ────────────
  async enqueueAutoSettlement(reservationId: string) {
    await escrowSettlementQueue.add(
      "auto-settle",
      { reservationId },
      {
        delay: 24 * 60 * 60 * 1000, // 24 hours
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      }
    );
    console.log(
      `[Escrow] Auto-settlement enqueued for reservation ${reservationId} (24h delay)`
    );
  }
}
