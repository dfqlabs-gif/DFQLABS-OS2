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

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.succeeded).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].companyName).toBe("Bright Homes Realty");
    expect(result.candidates[0].phone).toBe("08012345678");
  });

  it("reports provider failure when all public search requests fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const result = await new DirectoryDiscoverySource().discoverCandidates("Abuja", "real estate", 40);
    expect(result.succeeded).toBe(false);
    expect(result.errorCode).toBe("DIRECTORY_FETCH_FAILED");
  });
});
