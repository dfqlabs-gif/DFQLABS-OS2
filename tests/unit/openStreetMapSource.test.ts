import { describe, expect, it, vi } from "vitest";
import { OpenStreetMapDiscoverySource } from "../../src/server/services/discovery/openStreetMapSource.js";

describe("OpenStreetMapDiscoverySource", () => {
  it("is configured by default", () => {
    const source = new OpenStreetMapDiscoverySource();
    expect(source.isConfigured()).toBe(true);
    expect(source.name).toBe("OPENSTREETMAP");
  });

  it("handles Overpass API response parsing", async () => {
    const source = new OpenStreetMapDiscoverySource();

    const mockResponse = {
      elements: [
        {
          type: "node",
          id: 101,
          tags: {
            name: "Alpha Properties Abuja",
            office: "estate_agent",
            phone: "08012345678",
            website: "https://alphaproperties.ng",
            "addr:city": "Abuja"
          }
        }
      ]
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );

    const result = await source.discoverCandidates("Abuja", "real estate", 5);

    expect(result.succeeded).toBe(true);
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].companyName).toBe("Alpha Properties Abuja");
    expect(result.candidates[0].phone).toBe("08012345678");
  });
});
