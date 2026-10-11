import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicContactEnricher } from "../../src/server/services/discovery/publicContactEnricher.js";
import { RawCandidate } from "../../src/server/services/discovery/types.js";

function candidate(overrides: Partial<RawCandidate> = {}): RawCandidate {
  return {
    companyName: "Example Homes Limited",
    businessType: "real estate agency",
    location: "Abuja",
    description: "Real estate company in Abuja.",
    sourceFamily: "PUBLIC_DIRECTORY",
    sourceUrl: "https://example.com/contact",
    sourceTitle: "Example Homes Limited",
    sourceSnippet: "Real estate company in Abuja.",
    ...overrides
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PublicContactEnricher", () => {
  it("extracts a Nigerian phone from the public company page before qualification", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      '<html><body>Contact us: <a href="tel:+2348031234567">Call</a></body></html>',
      { status: 200, headers: { "content-type": "text/html" } }
    )));
    const [result] = await PublicContactEnricher.enrich([candidate()]);
    expect(result.phone).toBe("08031234567");
  });

  it("does not fetch social/search pages to guess contact details", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const [result] = await PublicContactEnricher.enrich([candidate({
      sourceUrl: "https://www.instagram.com/examplehomes/"
    })]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.phone).toBeUndefined();
  });

  it("preserves an existing phone and does not make an unnecessary request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const [result] = await PublicContactEnricher.enrich([candidate({ phone: "08031234567" })]);
    expect(result.phone).toBe("08031234567");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
