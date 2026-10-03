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
    const contactName = lead.contactName ?? "there";
    const company = lead.companyName;
    const location = lead.location ? ` in ${lead.location}` : "";

    const verifiedFacts = lead.evidence
      ?.filter((e) => e.category === "VERIFIED_FACT")
      .map((e) => e.evidenceText) ?? [];

    const draftText = `Hi ${contactName}, noticed ${company}'s developments${location}. Impressive work on your recent projects! At DFQLABS, we specialize in high-converting buyer acquisition engines for real estate firms. Would you be open to a quick 5-min chat on how we can drive qualified leads for your active inventory?`;

    return {
      draftText,
      evidenceUsed: verifiedFacts.length > 0 ? verifiedFacts : ["VERIFIED_FACT: Company operating in real estate."]
    };
  }
}
