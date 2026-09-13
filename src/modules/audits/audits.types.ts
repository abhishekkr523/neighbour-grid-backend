export type AuditType = "PICKUP" | "RETURN";
export type AuditImageCategory = "OVERVIEW" | "WEAR_POINTS" | "SERIAL_NUMBER";

export interface CreateAuditDto {
  reservation_id: string;
  audit_type: AuditType;
  image_url: string;
  image_category: AuditImageCategory;
  notes?: string;
}

export interface AuditResponse {
  id: string;
  reservation_id: string;
  uploaded_by: string;
  audit_type: AuditType;
  image_url: string;
  image_category: AuditImageCategory;
  notes: string | null;
  created_at: string;
}

// Required categories per audit (FR-5.1): at least one of each
export const REQUIRED_IMAGE_CATEGORIES: AuditImageCategory[] = [
  "OVERVIEW",
  "WEAR_POINTS",
  "SERIAL_NUMBER",
];
