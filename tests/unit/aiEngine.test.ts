import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/config/env.js", () => ({
  env: { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "test-model" }
}));

import { AIEngineService } from "../../src/server/services/aiEngine.js";
import type { Lead } from "../../src/shared/types/index.js";

const baseLead: Lead = {
  id: "20000000-0000-0000-0000-000000000001",
  companyName: "Example Homes",
  businessType: "Real estate developer",
  pipelineStage: "UNCONTACTED",
  status: "ACTIVE",
  ownerUserId: "user-1",
  createdByUserId: "user-1",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z"
};

afterEach(() => vi.unstubAllGlobals());

describe("winning audit first-touch outreach", () => {
  it("uses the winning short breakdown structure and forbids unsupported claims", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "Hi Example Homes,\n\nWe spotted an opportunity to strengthen your positioning for higher-value buyers. We can prepare a quick 6-minute breakdown. Would you like me to send it?" }] } }] })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await AIEngineService.generateFirstTouch({
      ...baseLead,
      socialProfiles: [{ id: "social-1", leadId: baseLead.id, platform: "INSTAGRAM", handleOrUrl: "https://instagram.com/examplehomes", normalizedIdentifier: "examplehomes", createdAt: baseLead.createdAt }],
      evidence: [{ id: "evidence-1", leadId: baseLead.id, sourceType: "INSTAGRAM_BIO", evidenceText: "Residential property developer", category: "VERIFIED_FACT", createdAt: baseLead.createdAt }]
    });

    const prompt = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).contents[0].parts[0].text as string;
    expect(prompt).toContain("proven outreach structure as the CONTROL");
    expect(prompt).toContain("Do not claim the breakdown has already been recorded/prepared");
    expect(prompt).toContain("Do not turn this into a generic introduction");
    expect(result.draftText).toContain("6-minute breakdown");
    expect(result.evidenceUsed).toContain("Residential property developer");
  });

  it("uses a safe fallback when AI generation is unavailable and does not claim an Instagram review without a profile", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const result = await AIEngineService.generateFirstTouch(baseLead);

    expect(result.draftText).toContain("Hi Example Homes");
    expect(result.draftText).toContain("We can put together a quick 6-minute breakdown");
    expect(result.draftText).not.toContain("your Instagram page");
  });
});
