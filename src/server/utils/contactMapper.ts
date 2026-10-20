import type { LeadContact } from "../../shared/types/index.js";

export interface LeadContactRow {
  id: string;
  lead_id: string;
  contact_type: LeadContact["contactType"];
  raw_value: string;
  normalized_value: string;
  is_primary: boolean;
  created_at: string;
}

/** Convert database snake_case contact rows to the camelCase API contract. */
export function mapLeadContactRow(row: LeadContactRow): LeadContact {
  return {
    id: row.id,
    leadId: row.lead_id,
    contactType: row.contact_type,
    rawValue: row.raw_value,
    normalizedValue: row.normalized_value,
    isPrimary: row.is_primary,
    createdAt: row.created_at
  };
}
