export interface PaymentHoldDto {
  reservationId: string;
}

export interface StripePaymentIntent {
  id: string;
  status: "requires_capture" | "succeeded" | "canceled";
  amount: number;
  capture_method: "manual" | "automatic";
}

export interface EscrowSettlementResult {
  rentalFeeCaptured: number;
  depositReleased: number;
  platformCommission: number;
  ownerPayout: number;
}
