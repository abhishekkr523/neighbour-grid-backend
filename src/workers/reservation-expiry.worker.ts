import { Worker } from "bullmq";
import { createRedisConnection } from "../config/redis";
import { pool } from "../config/db";

// FR-3.4: Auto-cancel PENDING reservations after 24 hours
const reservationExpiryWorker = new Worker(
  "reservation-expiry",
  async (job) => {
    const { reservationId } = job.data;
    console.log(
      `[Worker] Processing auto-cancel for reservation ${reservationId}`
    );

    const result = await pool.query(
      `UPDATE reservations
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING id, status`,
      [reservationId]
    );

    if (result.rows.length > 0) {
      console.log(
        `[Worker] Reservation ${reservationId} auto-cancelled (owner did not respond within 24h)`
      );
    } else {
      console.log(
        `[Worker] Reservation ${reservationId} was already handled (not in PENDING status)`
      );
    }
  },
  {
    connection: createRedisConnection(),
    // NFR-3.2: Retry with exponential backoff
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        return Math.min(attemptsMade * 5000, 30000);
      },
    },
  }
);

reservationExpiryWorker.on("completed", (job) => {
  console.log(
    `[Worker] Reservation expiry job ${job.id} completed`
  );
});

reservationExpiryWorker.on("failed", (job, err) => {
  console.error(
    `[Worker] Reservation expiry job ${job?.id} failed:`,
    err.message
  );
});

export default reservationExpiryWorker;
