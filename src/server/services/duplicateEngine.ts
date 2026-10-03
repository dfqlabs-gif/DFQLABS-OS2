import { DuplicateCheckResult, Lead } from "../../shared/types/index.js";
import { normalizePhone } from "../utils/phoneNormalizer.js";
import { normalizeSocialIdentifier } from "../utils/socialNormalizer.js";

function calculateTrigramSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/\s+/g, "");
  const s2 = str2.toLowerCase().replace(/\s+/g, "");

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const getTrigrams = (s: string) => {
    const trigrams: string[] = [];
    for (let i = 0; i < s.length - 2; i++) {
      trigrams.push(s.slice(i, i + 3));
    }
    return trigrams;
  };

  const t1 = getTrigrams(s1);
  const t2 = getTrigrams(s2);
  if (t1.length === 0 || t2.length === 0) return 0.0;

  const set2 = new Set(t2);
  const intersection = t1.filter((t) => set2.has(t)).length;
  return (2 * intersection) / (t1.length + t2.length);
}

export class DuplicateEngine {
  public static checkForDuplicate(
    input: { phone?: string; social?: string; website?: string; company?: string },
    existingLeads: Lead[]
  ): DuplicateCheckResult {
    const normPhone = input.phone ? normalizePhone(input.phone) : "";
    const normSocial = input.social ? normalizeSocialIdentifier(input.social) : "";
    const normWebsite = input.website ? normalizeSocialIdentifier(input.website) : "";

    for (const lead of existingLeads) {
      if (normPhone) {
        const hasPhoneMatch = lead.contacts?.some((c) => c.normalizedValue === normPhone);
        if (hasPhoneMatch) {
          return {
            matchType: "EXACT_MATCH",
            matchedLead: {
              id: lead.id,
              companyName: lead.companyName,
              ownerName: lead.ownerUserId
            },
            reason: `Normalized contact ${normPhone} matches existing lead ${lead.companyName}.`
          };
        }
      }

      if (normSocial) {
        const hasSocialMatch = lead.socialProfiles?.some((s) => s.normalizedIdentifier === normSocial);
        if (hasSocialMatch) {
          return {
            matchType: "EXACT_MATCH",
            matchedLead: {
              id: lead.id,
              companyName: lead.companyName,
              ownerName: lead.ownerUserId
            },
            reason: `Normalized social profile ${normSocial} matches existing lead ${lead.companyName}.`
          };
        }
      }

      if (normWebsite) {
        const hasWebsiteMatch = lead.socialProfiles?.some((s) => s.normalizedIdentifier === normWebsite);
        if (hasWebsiteMatch) {
          return {
            matchType: "EXACT_MATCH",
            matchedLead: {
              id: lead.id,
              companyName: lead.companyName,
              ownerName: lead.ownerUserId
            },
            reason: `Normalized website domain ${normWebsite} matches existing lead ${lead.companyName}.`
          };
        }
      }

      if (input.company && lead.companyName) {
        const similarity = calculateTrigramSimilarity(input.company, lead.companyName);
        if (similarity > 0.85) {
          return {
            matchType: "POTENTIAL_MATCH",
            matchedLead: {
              id: lead.id,
              companyName: lead.companyName,
              ownerName: lead.ownerUserId
            },
            reason: `Company name '${input.company}' has high similarity (${(similarity * 100).toFixed(0)}%) with existing lead '${lead.companyName}'.`
          };
        }
      }
    }

    return { matchType: "NO_MATCH" };
  }
}
