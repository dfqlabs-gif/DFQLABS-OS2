import { describe, expect, it } from "vitest";
import { DuplicateEngine } from "../../src/server/services/duplicateEngine.js";
import { Lead } from "../../src/shared/types/index.js";

describe("duplicateEngine", () => {
  const existingLeads: Lead[] = [
    {
      id: "lead-1",
      companyName: "ABC Properties Nigeria",
      pipelineStage: "UNCONTACTED",
      status: "ACTIVE",
      ownerUserId: "user-1",
      createdByUserId: "user-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contacts: [
        {
          id: "c-1",
          leadId: "lead-1",
          contactType: "WHATSAPP",
          rawValue: "08012345678",
          normalizedValue: "+2348012345678",
          isPrimary: true,
          createdAt: new Date().toISOString()
        }
      ],
      socialProfiles: [
        {
          id: "s-1",
          leadId: "lead-1",
          platform: "INSTAGRAM",
          handleOrUrl: "@abcproperties_ng",
          normalizedIdentifier: "abcproperties_ng",
          createdAt: new Date().toISOString()
        }
      ]
    }
  ];

  it("detects EXACT_MATCH on normalized phone number", () => {
    const result = DuplicateEngine.checkForDuplicate({ phone: "08012345678" }, existingLeads);
    expect(result.matchType).toBe("EXACT_MATCH");
    expect(result.matchedLead?.companyName).toBe("ABC Properties Nigeria");
  });

  it("detects EXACT_MATCH on social handle", () => {
    const result = DuplicateEngine.checkForDuplicate({ social: "https://instagram.com/abcproperties_ng" }, existingLeads);
    expect(result.matchType).toBe("EXACT_MATCH");
  });

  it("detects POTENTIAL_MATCH on high company name similarity", () => {
    const result = DuplicateEngine.checkForDuplicate({ company: "ABC Properties Nigeria Ltd" }, existingLeads);
    expect(result.matchType).toBe("POTENTIAL_MATCH");
  });

  it("returns NO_MATCH for distinct prospect", () => {
    const result = DuplicateEngine.checkForDuplicate({ company: "XYZ Realty Global", phone: "09099998888" }, existingLeads);
    expect(result.matchType).toBe("NO_MATCH");
  });
});
