import { Worker } from "bullmq";
import { createRedisConnection } from "../config/redis";
import { pool } from "../config/db";
import { EscrowService } from "../modules/escrow/escrow.service";

const escrowService = new EscrowService();

// FR-4.3: Auto-settle escrow 24 hours after return if no dispute
const escrowSettlementWorker = new Worker(
  "escrow-settlement",
  async (job) => {
    const { reservationId } = job.data;
    console.log(
      `[Worker] Processing auto-settlement for reservation ${reservationId}`
    );

    // Check current status — only settle if still RETURNED (no dispute filed)
    const resResult = await pool.query(
      `SELECT status FROM reservations WHERE id = $1`,
      [reservationId]
    );

    if (resResult.rows.length === 0) {
      console.log(
        `[Worker] Reservation ${reservationId} not found — skipping`
      );
      return;
    }

    const { status } = resResult.rows[0];

    if (status === "DISPUTED") {
      console.log(
        `[Worker] Reservation ${reservationId} has a dispute — skipping auto-settlement`
      );
      return;
    }

    if (status !== "RETURNED") {
      console.log(
        `[Worker] Reservation ${reservationId} is not in RETURNED status (${status}) — skipping`
      );
      return;
    }

    // No dispute filed within 24h — proceed with settlement
    const result = await escrowService.settleEscrow(reservationId);
    console.log(
      `[Worker] Reservation ${reservationId} settled: rental=${result.rentalFeeCaptured}¢, deposit released=${result.depositReleased}¢, commission=${result.platformCommission}¢`
    );
  },
  {
    connection: createRedisConnection(),
    // NFR-3.2: Retry with exponential backoff (3 attempts)
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        return Math.min(attemptsMade * 5000, 30000);
      },
    },
  }
);

escrowSettlementWorker.on("completed", (job) => {
  console.log(`[Worker] Escrow settlement job ${job.id} completed`);
});

escrowSettlementWorker.on("failed", (job, err) => {
  console.error(
    `[Worker] Escrow settlement job ${job?.id} failed:`,
    err.message
  );
});

export default escrowSettlementWorker;
