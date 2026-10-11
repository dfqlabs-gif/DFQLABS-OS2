import { env } from "../../config/env.js";
import { RawCandidate } from "./types.js";

export interface IdentityAssessment {
  companyName: string;
  confidence: number;
  reason: string;
  resolvedBy: "RULE" | "AI" | "UNCHANGED";
  phone?: string;
  email?: string;
}

const GENERIC_TITLE = /^(?:verified\s+)?(?:land|property|properties|house|apartment|duplex|two[- ]storey|two[- ]story|real estate company|real estate agency|property developer|real estate developer|luxury homes?|property listings?|land listings?|verified listings?)(?:\s+(?:for sale|in|at|available|abuja|lagos|uyo|benin city).*)?$/i;
const AD_TITLE = /\b(?:verified land listings?|property listings?|for sale|for rent|two[- ]storey|two[- ]story|price\s*[:₦]?\s*\d|₦\s?[\d,]+|verified listings?)\b/i;
const GENERIC_SOURCE_TITLE = /^(?:list your properties?|list your property|submit your property|real estate agencies in .+|list of (?:real estate )?(?:agencies|companies|businesses).+|directory of .+|.+ business directory|find real estate agents|property directory|top real estate companies(?: in .+)?)$/i;
const PUBLIC_PHONE_PATTERN = /(?:\+?234[\s().-]*[789][01](?:[\s().-]*\d){8}|0[\s().-]*[789][01](?:[\s().-]*\d){8})/g;
const PUBLIC_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig;
const ORG_SUFFIX = /\b([A-Z][A-Za-z&'.-]*(?:\s+[A-Z][A-Za-z&'.-]*){0,4}\s+(?:Homes?|Estates?|Realty|Properties|Property|Developments?|Developers?|Realtors?|Holdings|Group|Limited|Ltd\.?|PLC|Ventures|Shelters|Housing))\b/g;

function clean(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function plausibleName(value: string): boolean {
  const name = clean(value).replace(/\s*[|–—-]\s*.*$/, "").trim();
  if (name.length < 4 || name.length > 90) return false;
  if (GENERIC_TITLE.test(name) || AD_TITLE.test(name) || GENERIC_SOURCE_TITLE.test(name)) return false;
  if (/^(?:contact|call|whatsapp|for inquiries|verified|real estate company|property listings?|list your property|list your properties)\b/i.test(name)) return false;
  return /[a-z]/i.test(name) && /\s/.test(name);
}

function ruleBasedName(candidate: RawCandidate): string | null {
  const evidence = [candidate.sourceSnippet, candidate.description, candidate.sourceTitle].filter(Boolean).join(" ");
  const matches = [...evidence.matchAll(ORG_SUFFIX)].map((m) => m[1].trim());
  const name = matches.find(plausibleName);
  if (name) return name;
  const title = (candidate.sourceTitle || candidate.companyName).split(/\s[|–—-]\s/)[0].trim();
  if (!GENERIC_TITLE.test(title) && !AD_TITLE.test(title) && !GENERIC_SOURCE_TITLE.test(title) && plausibleName(title)) return title;
  return null;
}

async function assessBatch(candidates: RawCandidate[], location: string): Promise<Map<number, IdentityAssessment>> {
  const results = new Map<number, IdentityAssessment>();
  candidates.forEach((candidate, index) => {
    const ruleName = ruleBasedName(candidate);
    if (ruleName) results.set(index, { companyName: ruleName, confidence: 0.82, reason: "Organization name extracted from source evidence.", resolvedBy: "RULE" });
  });

  if (!env.GEMINI_API_KEY) return results;
  const unresolved = candidates.map((candidate, index) => ({ candidate, index })).filter(({ candidate, index }) =>
    !results.has(index) && (!plausibleName(candidate.companyName) || GENERIC_TITLE.test(candidate.companyName) || AD_TITLE.test(candidate.companyName) || GENERIC_SOURCE_TITLE.test(candidate.companyName) || candidate.companyName.length > 75)
  ).slice(0, 15);
  if (!unresolved.length) return results;

  const payload = unresolved.map(({ candidate }, index) => ({
    id: index,
    title: candidate.sourceTitle || candidate.companyName,
    snippet: (candidate.sourceSnippet || candidate.description || "").slice(0, 700),
    sourceUrl: candidate.sourceUrl || candidate.website || candidate.instagram || "",
    website: candidate.website || "",
    instagram: candidate.instagram || "",
    phone: candidate.phone || "",
    email: candidate.email || "",
    location: candidate.location || location
  }));

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are a conservative business-identity and public-contact extraction assessor for a Nigerian real-estate prospecting system. Inspect the profile/source title, snippet, URL, description and supplied contact details. Identify the actual real-estate business that owns or published the profile/listing only when evidence directly supports it. CTA headings such as "List your property", property-ad headlines, generic directory pages, search queries, prices and listing categories are not company names. Do not invent names, phone numbers, email addresses, websites or social handles. Use phone/email only when explicitly present in supplied evidence; otherwise return empty strings. Prefer the profile publisher's name over an individual property title. If uncertain, return companyName empty and confidence 0. Return JSON only in this shape: {"results":[{"id":0,"companyName":"...","confidence":0.0,"reason":"short evidence-based reason","phone":"","email":""}]}. Confidence must be 0 to 1. Only use confidence >= 0.80 when evidence explicitly connects the company to the source/listing. Location context: ${location}. Records: ${JSON.stringify(payload)}` }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1600, responseMimeType: "application/json" }
      })
    });
    if (!response.ok) return results;
    const json = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    const parsed = JSON.parse(text) as { results?: Array<{ id: number; companyName: string; confidence: number; reason?: string; phone?: string; email?: string }> };
    for (const item of parsed.results || []) {
      if (!Number.isInteger(item.id) || item.id < 0 || item.id >= unresolved.length) continue;
      const name = clean(item.companyName || "").replace(/\s*[|–—-]\s*.*$/, "").trim();
      const confidence = Number(item.confidence);
      if (confidence < 0.8 || !plausibleName(name)) continue;
      const originalIndex = unresolved[item.id].index;
      results.set(originalIndex, { companyName: name, confidence, reason: clean(item.reason || "Identity supported by source evidence."), resolvedBy: "AI",
        ...(item.phone && /(?:\+?234|0)[\s().-]*[789][01](?:[\s().-]*\d){8}/.test(item.phone) ? { phone: item.phone } : {}),
        ...(item.email && /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(item.email.trim()) ? { email: item.email.trim() } : {})
      });
    }
  } catch {
    // Conservative deterministic results remain available when AI is unavailable or returns malformed output.
  }
  return results;
}

export class CompanyIdentityResolver {
  static async resolve(candidates: RawCandidate[], location: string): Promise<RawCandidate[]> {
    if (!candidates.length) return candidates;
    const assessments = await assessBatch(candidates, location);
    return candidates.map((candidate, index) => {
      const assessment = assessments.get(index);
      const evidenceText = [candidate.sourceTitle, candidate.sourceSnippet, candidate.description].filter(Boolean).join(" ");
      const phoneFromEvidence = evidenceText.match(PUBLIC_PHONE_PATTERN)?.[0];
      const emailFromEvidence = evidenceText.match(PUBLIC_EMAIL_PATTERN)?.[0];
      const enrichedContact = {
        ...(!candidate.phone && phoneFromEvidence ? { phone: phoneFromEvidence } : {}),
        ...(!candidate.email && emailFromEvidence ? { email: emailFromEvidence } : {}),
        ...(assessment?.phone && !candidate.phone ? { phone: assessment.phone } : {}),
        ...(assessment?.email && !candidate.email ? { email: assessment.email } : {})
      };
      if (!assessment) return {
        ...candidate,
        ...enrichedContact,
        rawTags: { ...(candidate.rawTags || {}), identityAssessment: { status: "UNRESOLVED", originalTitle: candidate.sourceTitle || candidate.companyName } }
      };
      return {
        ...candidate,
        ...enrichedContact,
        companyName: assessment.companyName,
        rawTags: {
          ...(candidate.rawTags || {}),
          identityAssessment: {
            status: "RESOLVED",
            confidence: assessment.confidence,
            resolvedBy: assessment.resolvedBy,
            reason: assessment.reason,
            originalTitle: candidate.sourceTitle || candidate.companyName,
            originalCompanyName: candidate.companyName
          }
        }
      };
    });
  }
}
