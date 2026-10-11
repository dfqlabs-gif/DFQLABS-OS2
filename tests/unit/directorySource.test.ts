import { afterEach, describe, expect, it, vi } from "vitest";
import { DirectoryDiscoverySource } from "../../src/server/services/discovery/directorySource.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DirectoryDiscoverySource", () => {
  it("searches multiple query angles, extracts Nigerian contacts, and rejects listing titles", async () => {
    const html = [
      '<a class="result__a" href="https://example.com/real-estate">Bright Homes Realty</a>',
      '<div class="result__snippet">Real estate developer in Abuja. Call 08012345678.</div>',
      '<a class="result__a" href="https://example.com/house-sale">House for sale</a>',
      '<div class="result__snippet">Please contact 08098765432 for more information.</div>'
    ].join("");
    const fetchMock = vi.fn().mockResolvedValue(new Response(html, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new DirectoryDiscoverySource().discoverCandidates("Abuja", "real estate", 40);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(result.succeeded).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].companyName).toBe("Bright Homes Realty");
    expect(result.candidates[0].phone).toBe("08012345678");
  });

  it("does not return directory pages as prospect companies", async () => {
    const html = [
      '<a class="result__a" href="https://example.com/abuja-real-estate-directory">List of Business Companies in Abuja, Nigeria</a>',
      '<div class="result__snippet">This directory features a list of real estate agencies in Abuja, Nigeria. Owners or professionals can list their business.</div>',
      '<a class="result__a" href="https://businesslist.com.ng/abuja/real-estate">Real Estate Agencies in Abuja</a>',
      '<div class="result__snippet">Browse our business directory of agencies. Call 08012345678.</div>',
      '<a class="result__a" href="https://instagram.com/abujapropertyward">List your property | Abuja Property Ward</a>',
      '<div class="result__snippet">Abuja Property Ward real estate in Abuja. Call 08012345678.</div>'
    ].join("");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(html, { status: 200 })));
    const result = await new DirectoryDiscoverySource().discoverCandidates("Abuja", "real estate", 40);
    expect(result.candidates.some((candidate) => /directory|list of business companies|real estate agencies in abuja/i.test(candidate.companyName))).toBe(false);
    expect(result.candidates.some((candidate) => candidate.instagram === "https://instagram.com/abujapropertyward")).toBe(true);
  });

  it("reports provider failure when all public search requests fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const result = await new DirectoryDiscoverySource().discoverCandidates("Abuja", "real estate", 40);
    expect(result.succeeded).toBe(false);
    expect(result.errorCode).toBe("DIRECTORY_FETCH_FAILED");
  });
});
