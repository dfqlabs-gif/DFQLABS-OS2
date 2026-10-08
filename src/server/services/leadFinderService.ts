import { getSupabaseClient } from "../config/supabase.js";
import { PersistentProspectService } from "./persistentProspectService.js";
import { normalizeSocialIdentifier } from "../utils/socialNormalizer.js";
import { User } from "../../shared/types/index.js";

const DEFAULT_LOCATIONS = ["Abuja", "Kano", "Kaduna", "Jos", "Asaba", "Benin City", "Akwa Ibom"];
const DEFAULT_INDUSTRIES = ["real estate developer", "luxury realtor", "real estate agency", "property investment company"];

type SearchResult = { title?: string; link?: string; snippet?: string };
interface LeadFinderSettings {
  dailyTarget: number;
  minimumScore: number;
  locations: string[];
  industries: string[];
  preferredContact: string;
}

type Candidate = {
  companyName: string;
  location: string;
  description: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  email?: string;
  phone?: string;
  sourceUrl?: string;
  source: string;
  score: number;
  quality: "EXCELLENT" | "HIGH" | "GOOD" | "MEDIUM";
  outreachReady: boolean;
  breakdown: Record<string, number>;
};

function normalize(value?: string): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function domain(value?: string): string {
  try {
    const u = new URL(value || "");
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch { return ""; }
}

function socialId(value?: string): string {
  if (!value) return "";
  return value.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").split("?")[0];
}

function extractEmail(text: string): string | undefined {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function extractPhone(text: string): string | undefined {
  const candidates = text.match(/(?:\+?234|0)[0-9\s().-]{9,18}/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length === 13 && digits.startsWith("234")) return `+${digits}`;
    if (digits.length === 11 && digits.startsWith("0")) return `+234${digits.slice(1)}`;
  }
  return undefined;
}

function cleanDiscoveryText(value?: string): string {
  if (!value) return "";
  const cleaned = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /(<|>|\b)(table|tbody|thead|tr|td|script|style)(\b|>)/i.test(value)) return "";
  if (/\b(study|research|survey|article|blog|news|directory|report|jobs|vacancy|pdf)\b/i.test(cleaned) && cleaned.length > 240) return "";
  return cleaned.slice(0, 500);
}

function isValidInstagramProfile(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/^(www\.)?instagram\.com$/i.test(u.hostname)) return false;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return false;
    return !/^(p|reel|reels|explore|accounts|direct|stories|tv|tags|about|developer|privacy|legal)$/i.test(parts[0]);
  } catch { return false; }
}

function looksLikeCompanyResult(title: string, snippet: string, url: string): boolean {
  const titleText = normalize(title);
  const text = normalize([title, snippet, url].join(" "));
  const contentOnly = /\b(study|research|survey|article|blog|why|how to|near me|find real estate|top \d+|list of|directory|report|news|guide|market trends|jobs|vacancy|pdf)\b/i;
  const listingLike = /\b(plots?|units?|apartments?|houses?|homes?|properties?)\s+(for sale|available|at|on|near)|\b(for sale|for rent|renting|listing|price per plot|sqm|square metres?)\b/i;
  const titleEntitySignal = /\b(developer|developers|realty|realtor|real estate|property|properties|homes|housing|estate|investment|investments|holdings|group|groups|company|limited|ltd|agency|agencies)\b/i;
  if (contentOnly.test(text) || listingLike.test(text)) return false;
  if (isSocial(url, "instagram.com")) return isValidInstagramProfile(url) && titleEntitySignal.test(titleText);
  return titleEntitySignal.test(titleText) && /\b(real estate|realty|realtor|property|properties|developer|developers|development|homes|housing|estate|investment|holdings|group|agency)\b/i.test(text);
}

function cleanCompanyName(title: string, url: string): string {
  let value = title.split(/\s[|–—-]\s/)[0].trim();
  value = value.replace(/\s*\((Instagram|Facebook|LinkedIn)\)\s*$/i, "").trim();
  if (!value || /^(instagram|facebook|linkedin|google)$/i.test(value)) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      value = host.split(".")[0].replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    } catch { value = "Unknown Real Estate Company"; }
  }
  return value.slice(0, 255);
}

function qualityFor(score: number): Candidate["quality"] {
  if (score >= 90) return "EXCELLENT";
  if (score >= 80) return "HIGH";
  if (score >= 70) return "GOOD";
  return "MEDIUM";
}

function scoreCandidate(input: { title: string; snippet: string; url: string; location: string; industry: string; website?: string; instagram?: string; email?: string; phone?: string }) {
  const text = normalize([input.title, input.snippet, input.url, input.industry].join(" "));
  const industryFit = /(real estate|property|properties|realtor|realty|developer|development|homes|estate|housing|investment)/i.test(text) ? 20 : 0;
  const locationFit = text.includes(normalize(input.location)) || /nigeria|abuja|lagos|kano|kaduna|jos|asaba|benin|akwa/i.test(text) ? 10 : 0;
  const companyQuality = /(developer|luxury|premium|estate|group|holdings|investment|properties)/i.test(text) ? 10 : 4;
  const digitalPresence = (input.website || input.instagram) ? 10 : 0;
  const contentOpportunity = input.instagram ? (/(listing|property|home|estate|apartment|land)/i.test(text) ? 15 : 11) : 10;
  const websiteOpportunity = input.website ? 4 : 10;
  const highTicket = /(luxury|premium|commercial|investment|developer|estate|off.?plan|high.?end)/i.test(text) ? 10 : 5;
  const contactability = (input.phone ? 5 : 0) + (input.email ? 5 : 0);
  const strategicFit = /nigeria/i.test(text) || normalize(input.location) ? 5 : 0;
  const breakdown = { industryFit, locationFit, companyQuality, digitalPresence, contentOpportunity, websiteOpportunity, highTicket, contactability, strategicFit };
  const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));
  return { score, breakdown };
}

async function serperSearch(query: string, num = 10): Promise<SearchResult[]> {
  const key = process.env.SERPER_API_KEY?.trim();
  if (!key) {
    throw new Error("Lead Finder search is not configured on the server. Add SERPER_API_KEY to the production environment.");
  }

  let response: Response;
  try {
    response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl: "ng", hl: "en", num: Math.max(1, Math.min(20, num)) }),
      signal: AbortSignal.timeout(15000)
    });
  } catch (error) {
    throw new Error(`Lead Finder search provider is unreachable: ${error instanceof Error ? error.message : String(error)}`);
  }

  const raw = await response.text();
  let json: { organic?: SearchResult[]; message?: string; error?: string } = {};
  try {
    json = raw ? JSON.parse(raw) as typeof json : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    const providerMessage = json.message || json.error;
    throw new Error(`Lead Finder search provider failed with HTTP ${response.status}${providerMessage ? `: ${providerMessage}` : ""}`);
  }

  if (!Array.isArray(json.organic)) {
    throw new Error("Lead Finder search provider returned an invalid response.");
  }

  return json.organic;
}

async function enrich(url: string): Promise<Partial<Candidate>> {
  if (!url || /^https?:\/\/(www\.)?(instagram|facebook|linkedin|google)\./i.test(url)) return {};
  try {
    const response = await fetch(url, { headers: { "User-Agent": "DFQLABS-LeadFinder/1.0 (+https://dfqlabs.com.ng)" }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return {};
    const html = await response.text();
    const compact = html.replace(/<script[\\s\\S]*?<\/script>/gi, " ").replace(/<style[\\s\\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").slice(0, 120000);
    const instagram = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.-]+/i)?.[0];
    const facebook = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.-]+/i)?.[0];
    const linkedin = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_.-]+/i)?.[0];
    return { website: url, instagram, facebook, linkedin, email: extractEmail(compact), phone: extractPhone(compact), description: compact.slice(0, 900) };
  } catch { return { website: url }; }
}

function isSocial(url: string, host: string) {
  return new RegExp(`(^|\\.)${host.replace(".", "\\.")}$`, "i").test(domain(url));
}



function tokenOverlap(a?: string, b?: string): number {
  const left = new Set(normalize(a).split(" ").filter((x) => x.length >= 3));
  const right = new Set(normalize(b).split(" ").filter((x) => x.length >= 3));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  return shared / Math.max(left.size, right.size);
}

function domainBrand(value?: string): string {
  try {
    const host = new URL(value || "").hostname.replace(/^www\./i, "").toLowerCase();
    const parts = host.split(".");
    return normalize(parts.length > 2 ? parts.slice(0, -2).join(" ") : parts[0]);
  } catch { return ""; }
}

function realEstateEvidence(text: string): boolean {
  return /\b(real estate|realty|realtor|property|properties|developer|development|homes|housing|estate|investment|investments|holdings|land|residential|commercial)\b/i.test(text);
}

function listingLikeUrl(url: string): boolean {
  return /\b(search|listing|for-sale|for-rent|blog|article|news|category|tag|author|jobs|vacancy|pdf|youtube)\b/i.test(url);
}

function parseWebsiteIdentity(html: string) {
  const structuredNames: string[] = [];
  const structuredPhones: string[] = [];
  const sameAs: string[] = [];
  for (const block of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const m of block[1].matchAll(/["']name["']\s*:\s*["']([^"']{2,200})["']/gi)) structuredNames.push(m[1]);
    for (const m of block[1].matchAll(/["']telephone["']\s*:\s*["']([^"']{5,40})["']/gi)) structuredPhones.push(m[1]);
    for (const m of block[1].matchAll(/["']sameAs["']\s*:\s*(?:\[\s*)?["'](https?:\/\/[^"']+)["']/gi)) sameAs.push(m[1]);
  }
  return {
    name: structuredNames[0],
    telephone: structuredPhones[0],
    sameAs: [...new Set(sameAs)]
  };
}

async function inspectWebsite(url: string, companyName: string, location: string): Promise<{ website?: string; instagram?: string; facebook?: string; linkedin?: string; email?: string; phone?: string; description?: string; confidence: number; signals: string[]; evidence: Record<string, unknown> } | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "DFQLABS-LeadFinder/2.0 (+https://dfqlabs.com.ng)" },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return null;
    const html = await response.text();
    const identity = parseWebsiteIdentity(html);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || "";
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1];
    const siteName = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i)?.[1] || "";
    const compact = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();

    const instagram = identity.sameAs.find((s) => /instagram\.com/i.test(s)) || html.match(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.-]+/i)?.[0];
    const facebook = identity.sameAs.find((s) => /facebook\.com/i.test(s)) || html.match(/https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.-]+/i)?.[0];
    const linkedin = identity.sameAs.find((s) => /linkedin\.com\/(?:company|in)\//i.test(s)) || html.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_.-]+/i)?.[0];
    const email = extractEmail(compact);
    const phone = extractPhone(identity.telephone || "") || extractPhone(compact);
    const siteIdentity = identity.name || siteName;
    const nameOverlap = tokenOverlap(companyName, siteIdentity);
    const titleOverlap = tokenOverlap(companyName, title);
    const domainOverlap = tokenOverlap(companyName, domainBrand(url));
    const locationMatch = normalize(compact).includes(normalize(location));
    const realEstateMatch = realEstateEvidence(\`\${title} \${siteIdentity} \${compact.slice(0, 12000)}\`);
    const signals: string[] = [];
    if (domainOverlap >= 0.34) signals.push("DOMAIN_BRAND_MATCH");
    if (nameOverlap >= 0.5) signals.push("STRUCTURED_NAME_MATCH");
    if (titleOverlap >= 0.5) signals.push("PAGE_TITLE_MATCH");
    if (locationMatch) signals.push("LOCATION_MATCH");
    if (realEstateMatch) signals.push("REAL_ESTATE_CONTENT_MATCH");
    if (instagram && tokenOverlap(companyName, instagram.split("/").filter(Boolean).pop()) >= 0.5) signals.push("INSTAGRAM_HANDLE_MATCH");

    const confidence = Math.min(100, Math.round(
      domainOverlap * 40 + nameOverlap * 30 + titleOverlap * 15 +
      (locationMatch ? 5 : 0) + (realEstateMatch ? 10 : 0)
    ));
    const strong = signals.filter((s) => ["DOMAIN_BRAND_MATCH","STRUCTURED_NAME_MATCH","PAGE_TITLE_MATCH","INSTAGRAM_HANDLE_MATCH"].includes(s));
    if (confidence < 75 || strong.length < 2 || !realEstateMatch || !phone) return null;

    return {
      website: canonical || url,
      instagram, facebook, linkedin, email, phone,
      description: cleanDiscoveryText(compact),
      confidence,
      signals,
      evidence: {
        pageTitle: title || null,
        siteName: siteName || null,
        structuredName: siteIdentity || null,
        canonical: canonical || null,
        structuredTelephone: identity.telephone || null
      }
    };
  } catch { return null; }
}

async function resolveVerifiedWebsite(companyName: string, location: string): Promise<Awaited<ReturnType<typeof inspectWebsite>> | null> {
  const key = process.env.SERPER_API_KEY?.trim();
  if (!key) return null;
  const queries = [
    \`"\${companyName}" "\${location}" Nigeria real estate official website\`,
    \`"\${companyName}" "\${location}" Nigeria real estate\`
  ];
  const results: SearchResult[] = [];
  for (const query of queries) {
    try { results.push(...await serperSearch(query, 6)); } catch { /* enrichment is best effort */ }
    if (results.length >= 10) break;
  }

  const ranked = results
    .filter((r) => r.link && !listingLikeUrl(r.link) && !isSocial(r.link, "instagram.com") && !isSocial(r.link, "facebook.com") && !isSocial(r.link, "linkedin.com"))
    .map((r) => ({
      url: r.link!,
      score:
        tokenOverlap(companyName, r.title) * 45 +
        tokenOverlap(companyName, domainBrand(r.link)) * 30 +
        (realEstateEvidence(\`\${r.title || ""} \${r.snippet || ""}\`) ? 15 : 0) +
        (normalize(\`\${r.title || ""} \${r.snippet || ""}\`).includes(normalize(location)) ? 10 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  for (const candidate of ranked) {
    const verified = await inspectWebsite(candidate.url, companyName, location);
    if (verified) return verified;
  }
  return null;
}

export class LeadFinderService {
  private static readonly SETTINGS_ID = "00000000-0000-0000-0000-000000000030";
  static async getSettings(): Promise<LeadFinderSettings> {
    const db = getSupabaseClient();
    const fallback: LeadFinderSettings = { dailyTarget: 30, minimumScore: 70, locations: DEFAULT_LOCATIONS, industries: DEFAULT_INDUSTRIES, preferredContact: "WHATSAPP" };
    if (!db) return fallback;
    const { data, error } = await db.from("lead_finder_settings").select("*").eq("id", this.SETTINGS_ID).maybeSingle();
    if (error) {
      throw new Error(`Lead Finder database is not ready. Apply db/migrations/003_lead_finder.sql to the production Supabase database. Database error: ${error.message}`);
    }
    if (!data) return fallback;
    return {
      dailyTarget: data.daily_target,
      minimumScore: data.minimum_score,
      locations: Array.isArray(data.locations) ? data.locations.filter((value: unknown): value is string => typeof value === "string") : DEFAULT_LOCATIONS,
      industries: Array.isArray(data.industries) ? data.industries.filter((value: unknown): value is string => typeof value === "string") : DEFAULT_INDUSTRIES,
      preferredContact: typeof data.preferred_contact === "string" ? data.preferred_contact : fallback.preferredContact
    };
  }

  static async saveSettings(user: User, input: { dailyTarget?: number; minimumScore?: number; locations?: string[]; industries?: string[]; preferredContact?: string }) {
    if (user.role !== "FOUNDER") throw new Error("Founder access required.");
    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured.");
    const current = await this.getSettings();
    const next = {
      id: this.SETTINGS_ID,
      daily_target: Math.max(1, Math.min(500, input.dailyTarget ?? current.dailyTarget)),
      minimum_score: Math.max(50, Math.min(100, input.minimumScore ?? current.minimumScore)),
      locations: input.locations?.length ? input.locations : current.locations,
      industries: input.industries?.length ? input.industries : current.industries,
      preferred_contact: input.preferredContact || current.preferredContact,
      updated_by_user_id: user.id,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await db.from("lead_finder_settings").upsert(next).select("*").single();
    if (error || !data) throw new Error(error?.message || "Unable to save Lead Finder settings.");
    return { dailyTarget: data.daily_target, minimumScore: data.minimum_score, locations: Array.isArray(data.locations) ? data.locations.filter((value: unknown): value is string => typeof value === "string") : DEFAULT_LOCATIONS,
      industries: Array.isArray(data.industries) ? data.industries.filter((value: unknown): value is string => typeof value === "string") : DEFAULT_INDUSTRIES,
      preferredContact: typeof data.preferred_contact === "string" ? data.preferred_contact : current.preferredContact };
  }

  static async getTodaySummary(user: User) {
    const db = getSupabaseClient();
    const settings = await this.getSettings();
    if (!db) return { ...settings, target: settings.dailyTarget, newQualifiedToday: 0, remaining: settings.dailyTarget, status: "NOT_CONFIGURED", lastRun: null };
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(end.getDate()+1);
    let q = db.from("leads").select("id,discovery_score,outreach_ready,created_at,owner_user_id,discovery_run_id").eq("outreach_ready", true).not("discovery_run_id", "is", null).gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
    if (user.role !== "FOUNDER") q = q.eq("owner_user_id", user.id);
    const { data: leads, error: leadsError } = await q;
    const { data: runs, error: runsError } = await db.from("lead_finder_runs").select("*").order("created_at",{ascending:false}).limit(5);
    if (leadsError || runsError) {
      const dbError = leadsError?.message || runsError?.message || "Unknown database error";
      throw new Error(`Lead Finder database schema is not ready. Apply db/migrations/003_lead_finder.sql to the production Supabase database. Database error: ${dbError}`);
    }
    const count = leads?.length || 0;
    return { ...settings, target: settings.dailyTarget, newQualifiedToday: count, remaining: Math.max(0, settings.dailyTarget - count), status: count >= settings.dailyTarget ? "TARGET_MET" : "READY", lastRun: runs?.[0] || null };
  }

  static async runDaily(user: User, requestedTarget?: number) {
    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured.");
    const settings = await this.getSettings();

    // Google Places is deliberately optional. The free-first engine works with
    // Serper alone and uses multiple public source families (websites, Instagram,
    // LinkedIn and Nigerian business directories) before considering any paid provider.
    if (!process.env.SERPER_API_KEY?.trim()) {
      throw new Error("Lead Finder discovery is not configured on the server. Add SERPER_API_KEY to the production environment.");
    }

    const target = Math.max(1, Math.min(500, requestedTarget || settings.dailyTarget));
    const summary = await this.getTodaySummary(user);
    const remaining = Math.max(0, target - summary.newQualifiedToday);
    if (remaining === 0) return { ...summary, created: [], message: "Today's qualified prospect target is already met." };

    const today = new Date().toISOString().slice(0, 10);
    const { data: running } = await db.from("lead_finder_runs").select("id").eq("run_date", today).eq("status", "RUNNING").limit(1).maybeSingle();
    if (running) throw new Error("A Lead Finder run is already in progress.");

    const { data: run, error: runError } = await db.from("lead_finder_runs").insert({
      run_date: today, target, minimum_score: settings.minimumScore, requested_by_user_id: user.id,
      stats: { target, remainingBeforeRun: remaining, discoveryProvider: "SERPER_MULTI_SOURCE", enrichmentProvider: "DIRECT_WEBSITE" }
    }).select("*").single();
    if (runError || !run) throw new Error(runError?.message || "Unable to start Lead Finder run.");

    const sourceQueries = settings.locations.flatMap((location) => [
      {
        sourceFamily: "INSTAGRAM",
        query: `site:instagram.com "${location}" Nigeria ("real estate" OR realtor OR property OR developer) -jobs -news -article -directory`
      },
      {
        sourceFamily: "LINKEDIN",
        query: `site:linkedin.com/company "${location}" Nigeria ("real estate" OR property OR developer OR realtor)`
      },
      {
        sourceFamily: "DIRECTORY",
        query: `"${location}" Nigeria real estate company developer realtor properties -jobs -news -article -directory -listing`
      }
    ]);

    const existing = await this.existingIdentifiers();
    const seen = new Set<string>();
    const created: Candidate[] = [];
    let found = 0, qualified = 0, duplicate = 0, rejected = 0, insufficient = 0, providerQueries = 0;
    let verificationSearches = 0;
    const MAX_VERIFICATION_SEARCHES = Math.max(20, remaining * 2);

    const addCandidate = async (result: SearchResult, sourceFamily: string, location: string) => {
      const rawTitle = result.title?.trim() || "";
      const rawUrl = result.link?.trim() || "";
      const rawSnippet = cleanDiscoveryText(result.snippet);
      if (!rawTitle || !rawUrl || !looksLikeCompanyResult(rawTitle, rawSnippet, rawUrl)) {
        rejected++;
        return;
      }

      const companyName = cleanCompanyName(rawTitle, rawUrl);
      const companyKey = normalize(companyName);
      if (!companyKey || existing.has(companyKey) || seen.has(companyKey)) {
        duplicate++;
        return;
      }
      seen.add(companyKey);
      found++;

      let verified: Awaited<ReturnType<typeof inspectWebsite>> | null = null;

      // If the result is already an apparent company website, inspect it directly.
      // This is both cheaper and safer than trusting the search-result title.
      if (!isSocial(rawUrl, "instagram.com") && !isSocial(rawUrl, "facebook.com") && !isSocial(rawUrl, "linkedin.com") && !listingLikeUrl(rawUrl)) {
        verified = await inspectWebsite(rawUrl, companyName, location);
      }

      // Social pages/directories are discovery sources, not identity authorities.
      // Resolve them to a matching official website before a lead can be accepted.
      if (!verified && verificationSearches < MAX_VERIFICATION_SEARCHES) {
        verificationSearches++;
        verified = await resolveVerifiedWebsite(companyName, location);
      }

      if (!verified || !verified.phone || verified.confidence < 75) {
        rejected++;
        return;
      }

      const strongIdentitySignals = verified.signals.filter((signal) =>
        ["DOMAIN_BRAND_MATCH", "STRUCTURED_NAME_MATCH", "PAGE_TITLE_MATCH", "INSTAGRAM_HANDLE_MATCH"].includes(signal)
      );
      if (strongIdentitySignals.length < 2) {
        rejected++;
        return;
      }

      const phone = normalizeNigeriaPhone(verified.phone);
      if (!phone) {
        rejected++;
        return;
      }

      const identifiers = [
        phone,
        verified.website ? domain(verified.website) : "",
        verified.instagram ? normalizeSocialIdentifier(verified.instagram) : ""
      ].filter(Boolean);

      if (identifiers.some((id) => existing.has(normalize(id)) || seen.has(normalize(id)))) {
        duplicate++;
        return;
      }
      identifiers.forEach((id) => seen.add(normalize(id)));

      const scoreData = scoreCandidate({
        title: companyName,
        snippet: verified.description || rawSnippet,
        url: verified.website || rawUrl,
        location,
        industry: settings.industries[0] || "real estate",
        website: verified.website,
        instagram: verified.instagram,
        email: verified.email,
        phone
      });
      const quality = qualityFor(scoreData.score);
      if (scoreData.score < settings.minimumScore) {
        rejected++;
        return;
      }

      const lead = await PersistentProspectService.create({
        companyName,
        businessType: "REAL ESTATE",
        location,
        description: verified.description || `Verified ${sourceFamily.toLowerCase()} discovery for ${companyName}.`,
        phone,
        // Never equate a phone number with WhatsApp. WhatsApp availability is
        // unknown unless explicitly verified through an approved user-driven flow.
        email: verified.email,
        instagram: verified.instagram,
        website: verified.website,
        source: "LEAD_FINDER_SERPER",
        clientType: "AUTOMATED_DISCOVERY",
        serviceTier: quality
      }, user);

      const evidence = {
        discoverySourceFamily: sourceFamily,
        discoveryUrl: rawUrl,
        discoveryTitle: rawTitle,
        discoverySnippet: rawSnippet || null,
        website: verified.website || null,
        identityConfidence: verified.confidence,
        identitySignals: verified.signals,
        enrichmentEvidence: verified.evidence,
        verificationMethod: "OFFICIAL_WEBSITE_IDENTITY_RESOLUTION"
      };

      const { error: updateError } = await db.from("leads").update({
        discovery_score: scoreData.score,
        discovery_quality: quality,
        discovery_source: "SERPER_MULTI_SOURCE",
        discovery_provider: "SERPER",
        discovery_place_id: null,
        identity_confidence: verified.confidence,
        identity_signals: verified.signals,
        discovery_evidence: evidence,
        discovery_run_id: run.id,
        outreach_ready: true,
        updated_at: new Date().toISOString()
      }).eq("id", lead.id);

      if (updateError) {
        throw new Error(`Lead Finder saved the prospect but could not persist verification evidence: ${updateError.message}`);
      }

      qualified++;
      created.push({
        companyName,
        location,
        description: verified.description || "",
        website: verified.website,
        instagram: verified.instagram,
        facebook: verified.facebook,
        linkedin: verified.linkedin,
        email: verified.email,
        phone,
        sourceUrl: rawUrl,
        source: "SERPER_MULTI_SOURCE",
        score: scoreData.score,
        quality,
        outreachReady: true,
        breakdown: scoreData.breakdown
      });
    };

    try {
      for (const plan of sourceQueries) {
        if (created.length >= remaining) break;
        providerQueries++;

        let results: SearchResult[] = [];
        try {
          results = await serperSearch(plan.query, 10);
        } catch (error) {
          if (providerQueries === 1) throw error;
          continue;
        }

        const location = settings.locations.find((value) => plan.query.includes(`"${value}"`)) || settings.locations[0];
        for (const result of results) {
          if (created.length >= remaining) break;
          await addCandidate(result, plan.sourceFamily, location);
        }

        await db.from("lead_finder_runs").update({
          provider_queries: providerQueries,
          found_count: found,
          qualified_count: qualified,
          duplicate_count: duplicate,
          rejected_count: rejected,
          insufficient_count: insufficient,
          stats: {
            target,
            remainingBeforeRun: remaining,
            queriesTotal: sourceQueries.length,
            providerQueries,
            found,
            qualified,
            duplicate,
            rejected,
            insufficient,
            created: created.length,
            verificationSearches,
            discoveryProvider: "SERPER_MULTI_SOURCE",
            sourceFamilies: ["INSTAGRAM", "LINKEDIN", "DIRECTORY"],
            statusMessage: created.length >= remaining
              ? "Target reached. Finalizing verified prospects…"
              : `Free-first discovery pass ${providerQueries} of ${sourceQueries.length}`
          }
        }).eq("id", run.id);
      }

      const status = created.length >= remaining ? "COMPLETED" : "PARTIAL";
      await db.from("lead_finder_runs").update({
        status,
        found_count: found,
        qualified_count: qualified,
        duplicate_count: duplicate,
        rejected_count: rejected,
        insufficient_count: insufficient,
        provider_queries: providerQueries,
        stats: {
          target,
          remainingBeforeRun: remaining,
          created: created.length,
          locations: settings.locations,
          industries: settings.industries,
          discoveryProvider: "SERPER_MULTI_SOURCE",
          sourceFamilies: ["INSTAGRAM", "LINKEDIN", "DIRECTORY"],
          verificationSearches
        },
        completed_at: new Date().toISOString()
      }).eq("id", run.id);

      const final = await this.getTodaySummary(user);
      return {
        ...final,
        created,
        runId: run.id,
        stats: {
          found,
          qualified,
          duplicate,
          rejected,
          insufficient,
          providerQueries,
          verificationSearches,
          sourceFamilies: ["INSTAGRAM", "LINKEDIN", "DIRECTORY"]
        }
      };
    } catch (error) {
      await db.from("lead_finder_runs").update({
        status: "FAILED",
        found_count: found,
        qualified_count: qualified,
        duplicate_count: duplicate,
        rejected_count: rejected,
        insufficient_count: insufficient,
        provider_queries: providerQueries,
        stats: {
          error: error instanceof Error ? error.message : String(error),
          discoveryProvider: "SERPER_MULTI_SOURCE",
          verificationSearches
        },
        completed_at: new Date().toISOString()
      }).eq("id", run.id);
      throw error;
    }
  }

  private static async existingIdentifiers(): Promise<Set<string>> {
    const db = getSupabaseClient();
    const identifiers = new Set<string>();
    if (!db) return identifiers;
    const [{ data: leads }, { data: contacts }, { data: socials }] = await Promise.all([
      db.from("leads").select("company_name"),
      db.from("lead_contacts").select("normalized_value"),
      db.from("lead_social_profiles").select("normalized_identifier")
    ]);
    for (const row of leads || []) if (row.company_name) identifiers.add(normalize(row.company_name));
    for (const row of contacts || []) if (row.normalized_value) identifiers.add(normalize(row.normalized_value));
    for (const row of socials || []) if (row.normalized_identifier) identifiers.add(normalize(row.normalized_identifier));
    return identifiers;
  }

  static async resetToday(user: User) {
    if (user.role !== "FOUNDER") throw new Error("Founder access required.");
    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured.");
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const { data: leads, error: fetchError } = await db.from("leads")
      .select("id")
      .in("source", ["LEAD_FINDER_SERPER", "LEAD_FINDER_GOOGLE_PLACES", "LEAD_FINDER_OSM"])
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());
    if (fetchError) throw new Error(fetchError.message);
    const ids = (leads || []).map((row: { id: string }) => row.id);
    if (ids.length) {
      const { error: deleteError } = await db.from("leads").delete().in("id", ids);
      if (deleteError) throw new Error(deleteError.message);
    }
    const today = start.toISOString().slice(0, 10);
    const { error: runError } = await db.from("lead_finder_runs").delete().eq("run_date", today);
    if (runError) throw new Error(runError.message);
    const settings = await this.getSettings();
    return { ...settings, target: settings.dailyTarget, newQualifiedToday: 0, remaining: settings.dailyTarget, status: "READY", reset: true, deletedLeads: ids.length };
  }

  static async getHistory(limit = 20) {
    const db = getSupabaseClient();
    if (!db) return [];
    const { data } = await db.from("lead_finder_runs").select("*").order("created_at",{ascending:false}).limit(Math.min(50, limit));
    return data || [];
  }
}
