import { describe, expect, it, vi } from "vitest";
import { LeadFinderService } from "../../src/server/services/leadFinderService.js";
import { User } from "../../src/shared/types/index.js";

// Mock Supabase client module
vi.mock("../../src/server/config/supabase.js", () => {
  return {
    getSupabaseClient: () => null
  };
});

describe("LeadFinderService", () => {
  const mockFounder: User = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "founder@dfqlabs.com",
    fullName: "Founder User",
    role: "FOUNDER",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  it("getSettings returns default fallback settings when DB is not configured", async () => {
    const settings = await LeadFinderService.getSettings();
    expect(settings.dailyTarget).toBe(30);
    expect(settings.minimumScore).toBe(70);
    expect(settings.locations).toContain("Abuja");
  });

  it("getTodaySummary returns NOT_CONFIGURED status when DB is not configured", async () => {
    const summary = await LeadFinderService.getTodaySummary(mockFounder);
    expect(summary.status).toBe("NOT_CONFIGURED");
    expect(summary.newQualifiedToday).toBe(0);
    expect(summary.remaining).toBe(30);
  });
});
