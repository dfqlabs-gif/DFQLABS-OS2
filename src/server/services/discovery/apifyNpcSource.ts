import { DiscoverySource, RawCandidate, SourceQueryResult } from "./types.js";
import { env } from "../../config/env.js";

type ApifyListing = {
  title?: string; location?: string; url?: string; description?: string;
  agent?: string; phones?: string[]; phone?: string; verifiedAdvertiser?: boolean;
  verificationStatus?: string; listingTier?: string; _details?: { agentMemberSince?: string; verificationStatus?: string };
};

/**
 * Optional free-first discovery adapter for Nigeria Property Centre.
 * Apify's free plan currently includes $5 monthly platform credits without requiring a
 * credit card. This adapter caps each actor run and never enables per-listing detail fetches.
 */
export class ApifyNpcDiscoverySource implements DiscoverySource {
  public readonly name = "APIFY_NPC";

  public isConfigured(): boolean {
    return Boolean((env.APIFY_API_TOKEN || env.APIFY_API_KEY || process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY)?.trim());
  }

  public async discoverCandidates(location: string, industry: string, maxResults = 20): Promise<SourceQueryResult> {
    const started = Date.now();
    const token = (env.APIFY_API_TOKEN || env.APIFY_API_KEY || process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY)?.trim();
    if (!token) return {
      sourceName: this.name, attempted: false, succeeded: false, queriesCount: 0, candidates: [],
      errorCode: "NOT_CONFIGURED", errorMessage: "Apify is not configured. Set APIFY_API_TOKEN or APIFY_API_KEY in the Render web service environment, then redeploy.",
      executionDurationMs: Date.now() - started
    };

    try {
      const response = await fetch("https://api.apify.com/v2/acts/igolaizola~nigeriapropertycentre-scraper/run-sync-get-dataset-items?token=" + encodeURIComponent(token) + "&timeout=120&memory=512", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          maxItems: Math.max(5, Math.min(25, maxResults)),
          operation: "buy",
          location,
          fetchDetails: false,
          sort: "newest"
        }),
        signal: AbortSignal.timeout(130000)
      });
      const raw = await response.text();
      if (!response.ok) {
        throw new Error("Apify NPC actor returned HTTP " + response.status + (raw ? ": " + raw.slice(0, 250) : ""));
      }
      const data: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(data)) throw new Error("Apify NPC actor returned a non-array dataset.");
      const candidates: RawCandidate[] = (data as ApifyListing[]).flatMap((item) => {
        const agent = (item.agent || "").trim();
        const title = (item.title || "").trim();
        const phones = [...(Array.isArray(item.phones) ? item.phones : []), item.phone || ""].filter(Boolean);
        const phone = phones.find((value) => /(?:\+?234|0)[\s().-]*[789][01](?:[\s().-]*\d){8}/.test(value));
        // Listing headlines describe properties, not the company. Only the advertiser/agent
        // name is eligible as a prospect identity; do not promote an ad title into the CRM.
        if (!agent || agent.length < 3 || /^(?:unknown|n\/a|private advertiser|property owner)$/i.test(agent)) return [];
        const url = item.url || "";
        return [{
          companyName: agent,
          businessType: industry,
          location: item.location || location,
          description: [
            "Advertiser identified from a public Nigeria Property Centre listing.",
            title ? "Listing title: " + title : "",
            item.verifiedAdvertiser ? "Source marks advertiser as verified." : "",
            item.verificationStatus || item._details?.verificationStatus || ""
          ].filter(Boolean).join(" "),
          phone,
          sourceFamily: this.name,
          sourceUrl: url || undefined,
          sourceTitle: agent,
          sourceSnippet: [title, item.location, item.verificationStatus || item._details?.verificationStatus].filter(Boolean).join(" | "),
          rawTags: {
            listingTitle: title || null,
            verifiedAdvertiser: item.verifiedAdvertiser === true,
            listingTier: item.listingTier || null,
            advertiserVerificationStatus: item.verificationStatus || item._details?.verificationStatus || null,
            agentMemberSince: item._details?.agentMemberSince || null
          }
        }];
      });
      return { sourceName: this.name, attempted: true, succeeded: true, queriesCount: 1, candidates, executionDurationMs: Date.now() - started };
    } catch (error) {
      return {
        sourceName: this.name, attempted: true, succeeded: false, queriesCount: 1, candidates: [],
        errorCode: "APIFY_NPC_ERROR",
        errorMessage: error instanceof Error ? error.message : String(error),
        executionDurationMs: Date.now() - started
      };
    }
  }
}
