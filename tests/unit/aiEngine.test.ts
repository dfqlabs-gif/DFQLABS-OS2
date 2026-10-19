import { describe, expect, it } from "vitest";
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

describe("exact winning audit first-touch outreach", () => {
  it("uses the user's exact message and substitutes only the company name", async () => {
    const result = await AIEngineService.generateFirstTouch(baseLead);

    expect(result.draftText).toBe(
      "Hi Example Homes,\n\nI'm writing you because we noticed a huge positioning gap on your IG page that could be costing you higher-value buyers.\nIn fact we did a quick 6 min breakdown showing you and how you can fix it—should I send it?"
    );
  });

  it("does not paraphrase the winning message based on prospect evidence", async () => {
    const result = await AIEngineService.generateFirstTouch({
      ...baseLead,
      companyName: "Aceas Luxury Homes",
      socialProfiles: [{
        id: "social-1",
        leadId: baseLead.id,
        platform: "INSTAGRAM",
        handleOrUrl: "https://instagram.com/aceas",
        normalizedIdentifier: "aceas",
        createdAt: baseLead.createdAt
      }],
      evidence: [{
        id: "evidence-1",
        leadId: baseLead.id,
        sourceType: "INSTAGRAM_BIO",
        evidenceText: "Luxury property developer",
        category: "VERIFIED_FACT",
        createdAt: baseLead.createdAt
      }]
    });

    expect(result.draftText).toBe(
      "Hi Aceas Luxury Homes,\n\nI'm writing you because we noticed a huge positioning gap on your IG page that could be costing you higher-value buyers.\nIn fact we did a quick 6 min breakdown showing you and how you can fix it—should I send it?"
    );
    expect(result.evidenceUsed).toContain("Luxury property developer");
  });
});
