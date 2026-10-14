import { describe, expect, it, vi } from "vitest";
import { LeadFinderService, assessLeadFinderDuplicate } from "../../src/server/services/leadFinderService.js";
import { User } from "../../src/shared/types/index.js";

// Mock Supabase client module
vi.mock("../../src/server/config/supabase.js", () => {
  return {
    getSupabaseClient: () => null
  };
});

describe("LeadFinderService", () => {
  const mockFounder: User = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "founder@dfqlabs.com",
    fullName: "Founder User",
    role: "FOUNDER",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  it("getSettings returns default fallback settings when DB is not configured", async () => {
    const settings = await LeadFinderService.getSettings();
    expect(settings.dailyTarget).toBe(30);
    expect(settings.minimumScore).toBe(70);
    expect(settings.locations).toContain("Abuja");
  });

  it("getTodaySummary returns NOT_CONFIGURED status when DB is not configured", async () => {
    const summary = await LeadFinderService.getTodaySummary(mockFounder);
    expect(summary.status).toBe("NOT_CONFIGURED");
    expect(summary.newQualifiedToday).toBe(0);
    expect(summary.remaining).toBe(30);
  });
});

describe("Lead Finder duplicate assessment", () => {
  const base = {
    companyKey: "f sky homes",
    identifiers: ["+2348012345678", "fskyhomes.com", "fskyhomes"],
    existingCompanyNames: new Set<string>(),
    existingContactIdentifiers: new Set<string>(),
    existingSocialIdentifiers: new Set<string>(),
    seenCompanyNames: new Set<string>(),
    seenContactIdentifiers: new Set<string>()
  };

  it("treats an exact normalized phone identity as a confirmed duplicate", () => {
    const result = assessLeadFinderDuplicate({
      ...base,
      existingContactIdentifiers: new Set(["+2348012345678"])
    });
    expect(result).toBe("CONFIRMED_DUPLICATE");
  });

  it("does not treat a company-name-only match as a confirmed duplicate", () => {
    const result = assessLeadFinderDuplicate({
      ...base,
      existingCompanyNames: new Set(["f sky homes"])
    });
    expect(result).toBe("POTENTIAL_DUPLICATE");
  });

  it("prioritizes exact identity evidence over a company-name-only match", () => {
    const result = assessLeadFinderDuplicate({
      ...base,
      existingCompanyNames: new Set(["f sky homes"]),
      existingSocialIdentifiers: new Set(["fskyhomes"])
    });
    expect(result).toBe("CONFIRMED_DUPLICATE");
  });

  it("returns no match when neither name nor contact identity matches", () => {
    expect(assessLeadFinderDuplicate(base)).toBe("NO_MATCH");
  });
});
