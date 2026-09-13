export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ESCROWED"
  | "ACTIVE_IN_USE"
  | "RETURNED"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED";

export interface CreateReservationDto {
  tool_id: string;
  start_date: string; // ISO 8601 date string (YYYY-MM-DD)
  end_date: string;   // ISO 8601 date string (YYYY-MM-DD)
}

export interface ReservationResponse {
  id: string;
  tool_id: string;
  borrower_id: string;
  start_date: string;
  end_date: string;
  status: ReservationStatus;
  total_fee_cents: number;
  deposit_cents: number;
  stripe_payment_intent_id: string | null;
  created_at: string;
  // Joined fields
  tool_title?: string;
  borrower_name?: string;
  owner_id?: string;
}
