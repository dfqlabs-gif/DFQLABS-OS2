import { describe, expect, it } from "vitest";
import { mapLeadContactRow } from "../../src/server/utils/contactMapper.js";

describe("prospect contact API mapping", () => {
  it("returns camelCase contact fields consumed by the prospect dossier and WhatsApp action", () => {
    const contact = mapLeadContactRow({
      id: "contact-1",
      lead_id: "lead-1",
      contact_type: "WHATSAPP",
      raw_value: "08012345678",
      normalized_value: "+2348012345678",
      is_primary: true,
      created_at: "2026-10-20T12:00:00.000Z"
    });

    expect(contact).toEqual({
      id: "contact-1",
      leadId: "lead-1",
      contactType: "WHATSAPP",
      rawValue: "08012345678",
      normalizedValue: "+2348012345678",
      isPrimary: true,
      createdAt: "2026-10-20T12:00:00.000Z"
    });
    expect(contact.normalizedValue).toBe("+2348012345678");
  });
});
