import { describe, expect, it, vi } from "vitest";
import { hasVerifiedNigerianBusinessPhone, isDirectoryCandidate, scoreCandidate, shouldDisableDiscoverySource } from "../../src/server/services/leadFinderService.js";

vi.mock("../../src/server/config/supabase.js", () => ({
  getSupabaseClient: () => null
}));

describe("Lead Finder qualification scoring", () => {
  it("accepts a verified Nigerian business mobile as sufficient outreach contact without requiring a social URL", () => {
    expect(hasVerifiedNigerianBusinessPhone({ phone: "08012345678" })).toBe(true);
    expect(hasVerifiedNigerianBusinessPhone({ phone: "+234 801 234 5678" })).toBe(true);
    expect(hasVerifiedNigerianBusinessPhone({ phone: "0123456789" })).toBe(false);
    expect(hasVerifiedNigerianBusinessPhone({ phone: undefined })).toBe(false);
  });

  it("opens a provider circuit only for provider-wide failures, not an ordinary empty result", () => {
    expect(shouldDisableDiscoverySource({ succeeded: false, errorCode: "DIRECTORY_FETCH_FAILED" })).toBe(true);
    expect(shouldDisableDiscoverySource({ succeeded: false, errorCode: "OSM_UNREACHABLE" })).toBe(true);
    expect(shouldDisableDiscoverySource({ succeeded: false, errorCode: "NOT_CONFIGURED" })).toBe(true);
    expect(shouldDisableDiscoverySource({ succeeded: false, errorCode: "GOOGLE_PLACES_NO_RESULTS" })).toBe(false);
    expect(shouldDisableDiscoverySource({ succeeded: true, errorCode: undefined })).toBe(false);
  });

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
