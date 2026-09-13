export type DisputeStatus =
  | "OPEN"
  | "RESOLVED_OWNER"
  | "RESOLVED_BORROWER"
  | "CLOSED";

export interface FileDisputeDto {
  reservation_id: string;
  reason: string;
  evidence_urls?: string[];
}

export interface ResolveDisputeDto {
  resolution: "RESOLVED_OWNER" | "RESOLVED_BORROWER";
  admin_notes?: string;
}

export interface DisputeResponse {
  id: string;
  reservation_id: string;
  filed_by: string;
  reason: string;
  evidence_urls: string[];
  status: DisputeStatus;
  admin_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}
