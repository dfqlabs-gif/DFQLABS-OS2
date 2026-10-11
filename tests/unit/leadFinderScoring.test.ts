import { describe, expect, it, vi } from "vitest";
import { isDirectoryCandidate, scoreCandidate } from "../../src/server/services/leadFinderService.js";

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

  it("rejects directory pages as prospects even when discovered by a general search provider", () => {
    expect(isDirectoryCandidate({
      companyName: "List of Business Companies in Abuja, Nigeria",
      sourceTitle: "List of Business Companies in Abuja, Nigeria",
      sourceSnippet: "This directory features a list of real estate agencies in Abuja, Nigeria. Owners or professionals can list their business.",
      sourceUrl: "https://example.com/abuja-real-estate-directory"
    })).toBe(true);
    expect(isDirectoryCandidate({
      companyName: "Real Estate Agencies in Abuja",
      sourceTitle: "Real Estate Agencies in Abuja",
      sourceUrl: "https://businesslist.com.ng/abuja/real-estate"
    })).toBe(true);
  });

  it("keeps a social profile with a generic call-to-action title for identity resolution", () => {
    expect(isDirectoryCandidate({
      companyName: "List your property",
      sourceTitle: "List your property | Abuja Property Ward",
      sourceSnippet: "Abuja Property Ward is a real estate publisher. Call 08012345678.",
      sourceUrl: "https://www.instagram.com/abujapropertyward/",
      instagram: "https://www.instagram.com/abujapropertyward/"
    })).toBe(false);
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
