import { describe, expect, it, vi } from "vitest";
import { CompanyIdentityResolver } from "../../src/server/services/discovery/companyIdentityResolver.js";
import { RawCandidate } from "../../src/server/services/discovery/types.js";

vi.mock("../../src/server/config/env.js", () => ({
  env: { GEMINI_API_KEY: undefined, GEMINI_MODEL: "gemini-2.5-flash" }
}));

function candidate(overrides: Partial<RawCandidate> = {}): RawCandidate {
  return {
    companyName: "Verified land listings in Uyo, Akwa Ibom",
    businessType: "real estate agency",
    location: "Uyo",
    description: "Verified land listings in Uyo, Akwa Ibom. Terra Arc Homes Limited provides property advisory.",
    sourceFamily: "PUBLIC_DIRECTORY",
    sourceTitle: "Verified land listings in Uyo, Akwa Ibom",
    sourceSnippet: "Terra Arc Homes Limited provides property advisory and land sales in Uyo. Call 08012345678.",
    sourceUrl: "https://example.com/listings",
    phone: "08012345678",
    ...overrides
  };
}

describe("CompanyIdentityResolver", () => {
  it("resolves an ad headline to a company name explicitly present in source evidence", async () => {
    const [resolved] = await CompanyIdentityResolver.resolve([candidate()], "Uyo");
    expect(resolved.companyName).toBe("Terra Arc Homes Limited");
    expect(resolved.rawTags?.identityAssessment).toMatchObject({
      status: "RESOLVED",
      resolvedBy: "RULE",
      originalTitle: "Verified land listings in Uyo, Akwa Ibom"
    });
  });

  it("does not invent a company identity when the evidence only contains a generic headline", async () => {
    const [resolved] = await CompanyIdentityResolver.resolve([candidate({
      description: "Verified land listings in Uyo, Akwa Ibom. Contact the advertiser for more information.",
      sourceSnippet: "Verified land listings in Uyo, Akwa Ibom. Contact the advertiser for more information."
    })], "Uyo");
    expect(resolved.companyName).toBe("Verified land listings in Uyo, Akwa Ibom");
    expect(resolved.rawTags?.identityAssessment).toMatchObject({ status: "UNRESOLVED" });
  });

  it("treats call-to-action page titles as unresolved company names", async () => {
    const [resolved] = await CompanyIdentityResolver.resolve([candidate({
      companyName: "List your property",
      sourceTitle: "List your property",
      description: "Post your property for sale or rent. Contact our team.",
      sourceSnippet: "Owners or professionals can list their property on this platform."
    })], "Abuja");
    expect(resolved.companyName).toBe("List your property");
    expect(resolved.rawTags?.identityAssessment).toMatchObject({ status: "UNRESOLVED" });
  });

  it("extracts a visibly published phone and email from source evidence without inventing contact details", async () => {
    const [resolved] = await CompanyIdentityResolver.resolve([candidate({
      companyName: "Abuja Property Ward",
      sourceTitle: "Abuja Property Ward",
      phone: undefined,
      email: undefined,
      sourceSnippet: "Real estate services in Abuja. Call 0802 0771 659 or email hello@abujapropertyward.ng."
    })], "Abuja");
    expect(resolved.phone).toBe("0802 0771 659");
    expect(resolved.email).toBe("hello@abujapropertyward.ng");
  });

  it("preserves a credible company title and the original source headline", async () => {
    const [resolved] = await CompanyIdentityResolver.resolve([candidate({
      companyName: "Savy Real Estate",
      sourceTitle: "Savy Real Estate | Abuja Property",
      sourceSnippet: "Savy Real Estate provides property services in Abuja."
    })], "Abuja");
    expect(resolved.companyName).toBe("Savy Real Estate");
    expect(resolved.rawTags?.identityAssessment).toMatchObject({ status: "RESOLVED" });
  });
});
