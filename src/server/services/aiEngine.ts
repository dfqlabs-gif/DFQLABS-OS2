import { Lead } from "../../shared/types/index.js";

export interface BriefingResult {
  overview: string;
  keyFacts: string[];
  recommendedHook: string;
}

export interface FirstTouchDraftResult {
  draftText: string;
  evidenceUsed: string[];
}

export class AIEngineService {
  public static async generateBriefing(lead: Lead): Promise<BriefingResult> {
    const verifiedFacts = lead.evidence
      ?.filter((e) => e.category === "VERIFIED_FACT")
      .map((e) => e.evidenceText) ?? [];

    const overview = `Prospect briefing for ${lead.companyName} (${lead.businessType ?? "Real Estate"}) in ${lead.location ?? "Nigeria"}.`;
    const keyFacts = verifiedFacts.length > 0 ? verifiedFacts : ["VERIFIED_FACT: Operating real estate firm."];
    const hook = lead.location
      ? `Mention localized presence in ${lead.location} and portfolio quality.`
      : "Focus on operational scalability and sales performance.";

    return {
      overview,
      keyFacts,
      recommendedHook: hook
    };
  }

  public static async generateFirstTouch(lead: Lead): Promise<FirstTouchDraftResult> {
    const contactName = lead.contactName ? ` ${lead.contactName}` : "";
    const verifiedFacts = lead.evidence?.filter((e) => e.category === "VERIFIED_FACT").map((e) => e.evidenceText) ?? [];
    const context = verifiedFacts.length ? ` I noticed this from the information we have on your business: ${verifiedFacts[0]}` : "";
    const draftText = `Hi${contactName}, I’m reaching out from DFQLABS. We help real estate companies improve how their positioning and content turn attention into serious buyer conversations.${context} I’d be happy to share one useful observation about your current content and positioning. Would you be open to that?`;
    return { draftText, evidenceUsed: verifiedFacts };
  }
}
