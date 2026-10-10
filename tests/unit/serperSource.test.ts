import { describe, expect, it, vi } from "vitest";
import { SerperDiscoverySource } from "../../src/server/services/discovery/serperSource.js";

describe("SerperDiscoverySource", () => {
  it("detects credit exhaustion and returns SERPER_CREDITS_EXHAUSTED error code", async () => {
    process.env.SERPER_API_KEY = "test_key";
    const source = new SerperDiscoverySource();

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not enough credits" }), { status: 400 })
    );

    const result = await source.discoverCandidates("Abuja", "real estate", 5);

    expect(result.succeeded).toBe(false);
    expect(result.errorCode).toBe("SERPER_CREDITS_EXHAUSTED");
    expect(result.errorMessage).toContain("Not enough credits");
  });
  it("does not repeat requests after the provider reports exhausted credits", async () => {
    process.env.SERPER_API_KEY = "test_key";
    const source = new SerperDiscoverySource();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not enough credits" }), { status: 400 })
    );

    const first = await source.discoverCandidates("Abuja", "real estate", 5);
    const second = await source.discoverCandidates("Kano", "real estate", 5);

    expect(first.errorCode).toBe("SERPER_CREDITS_EXHAUSTED");
    expect(second.errorCode).toBe("SERPER_CREDITS_EXHAUSTED");
    expect(second.queriesCount).toBe(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

});
