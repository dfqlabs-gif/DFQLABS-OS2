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
});
