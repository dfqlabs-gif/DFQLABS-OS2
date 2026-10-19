import { describe, expect, it, vi } from "vitest";
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

describe("exact winning first-touch outreach", () => {
  it("preserves the user's wording, punctuation, and line breaks while substituting only the company name", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await AIEngineService.generateFirstTouch(baseLead);

    expect(result.draftText).toBe(
      "Hi Example Homes,\n\n" +
      "I'm writing you because we noticed a huge positioning gap on your IG page that could be costing you higher-value buyers.\n" +
      "In fact we did a quick 6 min breakdown showing you and how you can fix it—should I send it?"
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("does not paraphrase the message for different companies", async () => {
    const result = await AIEngineService.generateFirstTouch({
      ...baseLead,
      companyName: "Aceas Luxury Homes"
    });

    expect(result.draftText).toBe(
      "Hi Aceas Luxury Homes,\n\n" +
      "I'm writing you because we noticed a huge positioning gap on your IG page that could be costing you higher-value buyers.\n" +
      "In fact we did a quick 6 min breakdown showing you and how you can fix it—should I send it?"
    );
  });
});
