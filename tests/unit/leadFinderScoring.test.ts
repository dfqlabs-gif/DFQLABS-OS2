import { describe, expect, it, vi } from "vitest";
import { scoreCandidate } from "../../src/server/services/leadFinderService.js";

vi.mock("../../src/server/config/supabase.js", () => ({
  getSupabaseClient: () => null
}));

describe("Lead Finder qualification scoring", () => {
  it("recognizes market relevance from the discovery location when real-estate evidence is present", () => {
    const result = scoreCandidate({
      companyName: "Bright Homes Realty",
      description: "Real estate company offering residential property services.",
      location: "Abuja",
      industry: "real estate agency",
      phone: "08012345678"
    });
    expect(result.hasRealEstateEvidence).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("does not award industry fit based only on a location", () => {
    const result = scoreCandidate({
      companyName: "Bright Retail Group",
      description: "Fashion and lifestyle retail company.",
      location: "Abuja",
      industry: "real estate agency",
      phone: "08012345678"
    });
    expect(result.hasRealEstateEvidence).toBe(false);
  });
});
