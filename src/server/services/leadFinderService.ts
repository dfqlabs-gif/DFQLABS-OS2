import { getSupabaseClient } from "../config/supabase.js";
import { PersistentProspectService } from "./persistentProspectService.js";
import { User } from "../../shared/types/index.js";

const DEFAULT_LOCATIONS = ["Abuja", "Kano", "Kaduna", "Jos", "Asaba", "Benin City", "Akwa Ibom"];
const DEFAULT_INDUSTRIES = ["real estate developer", "luxury realtor", "real estate agency", "property investment company"];

type SearchResult = { title?: string; link?: string; snippet?: string };
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
  const matches = text.match(/(?:\+234|0)[0-9][0-9\s().-]{7,15}/g) || [];
  return matches.map((x) => x.replace(/[^+0-9]/g, "")).find((x) => x.length >= 10 && x.length <= 14);
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
  const digitalPresence = (input.website ? 5 : 0) + (input.instagram ? 5 : 0);
  const contentOpportunity = input.instagram ? (/(listing|property|home|estate|apartment|land)/i.test(text) ? 15 : 11) : 10;
  const websiteOpportunity = input.website ? 4 : 10;
  const highTicket = /(luxury|premium|commercial|investment|developer|estate|off.?plan|high.?end)/i.test(text) ? 10 : 5;
  const contactability = (input.phone ? 5 : 0) + (input.email ? 5 : 0);
  const strategicFit = /nigeria/i.test(text) || normalize(input.location) ? 5 : 0;
  const breakdown = { industryFit, locationFit, companyQuality, digitalPresence, contentOpportunity, websiteOpportunity, highTicket, contactability, strategicFit };
  const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));
  return { score, breakdown };
}

async function serperSearch(query: string): Promise<SearchResult[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error("Lead Finder is not configured. Add SERPER_API_KEY to the server environment.");
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "ng", hl: "en", num: 10 })
  });
  if (!response.ok) throw new Error(`Search provider failed with HTTP ${response.status}`);
  const json = await response.json() as { organic?: SearchResult[] };
  return json.organic || [];
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

export class LeadFinderService {
  private static readonly SETTINGS_ID = "00000000-0000-0000-0000-000000000030";
  static async getSettings() {
    const db = getSupabaseClient();
    const fallback = { dailyTarget: 30, minimumScore: 70, locations: DEFAULT_LOCATIONS, industries: DEFAULT_INDUSTRIES, preferredContact: "WHATSAPP" };
    if (!db) return fallback;
    const { data } = await db.from("lead_finder_settings").select("*").eq("id", this.SETTINGS_ID).maybeSingle();
    if (!data) return fallback;
    return {
      dailyTarget: data.daily_target,
      minimumScore: data.minimum_score,
      locations: Array.isArray(data.locations) ? data.locations : DEFAULT_LOCATIONS,
      industries: Array.isArray(data.industries) ? data.industries : DEFAULT_INDUSTRIES,
      preferredContact: data.preferred_contact
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
    return { dailyTarget: data.daily_target, minimumScore: data.minimum_score, locations: data.locations, industries: data.industries, preferredContact: data.preferred_contact };
  }

  static async getTodaySummary(user: User) {
    const db = getSupabaseClient();
    const settings = await this.getSettings();
    if (!db) return { ...settings, target: settings.dailyTarget, newQualifiedToday: 0, remaining: settings.dailyTarget, status: "NOT_CONFIGURED", lastRun: null };
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(end.getDate()+1);
    let q = db.from("leads").select("id,discovery_score,outreach_ready,created_at,owner_user_id").eq("outreach_ready", true).gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
    if (user.role !== "FOUNDER") q = q.eq("owner_user_id", user.id);
    const { data: leads } = await q;
    const { data: runs } = await db.from("lead_finder_runs").select("*").order("created_at",{ascending:false}).limit(5);
    const count = leads?.length || 0;
    return { ...settings, target: settings.dailyTarget, newQualifiedToday: count, remaining: Math.max(0, settings.dailyTarget - count), status: count >= settings.dailyTarget ? "TARGET_MET" : "READY", lastRun: runs?.[0] || null };
  }

  static async runDaily(user: User, requestedTarget?: number) {
    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured.");
    const settings = await this.getSettings();
    const target = Math.max(1, Math.min(500, requestedTarget || settings.dailyTarget));
    const today = new Date().toISOString().slice(0,10);
    const summary = await this.getTodaySummary(user);
    const remaining = Math.max(0, target - summary.newQualifiedToday);
    if (remaining === 0) return { ...summary, created: [], message: "Today's qualified prospect target is already met." };

    const { data: running } = await db.from("lead_finder_runs").select("id").eq("run_date", today).eq("status","RUNNING").limit(1).maybeSingle();
    if (running) throw new Error("A Lead Finder run is already in progress.");

    const { data: run, error: runError } = await db.from("lead_finder_runs").insert({
      run_date: today, target, minimum_score: settings.minimumScore, requested_by_user_id: user.id
    }).select("*").single();
    if (runError || !run) throw new Error(runError?.message || "Unable to start Lead Finder run.");

    const queries: string[] = [];
    for (const location of settings.locations) {
      for (const industry of settings.industries.slice(0, 3)) {
        queries.push(`"${industry}" "${location}" Nigeria real estate company`);
        queries.push(`site:instagram.com "${industry}" "${location}" Nigeria`);
      }
    }

    const existing = await this.existingIdentifiers();
    const seen = new Set<string>();
    const created: Candidate[] = [];
    let found = 0, qualified = 0, duplicate = 0, rejected = 0, insufficient = 0, providerQueries = 0;

    try {
      for (const query of queries) {
        if (created.length >= remaining) break;
        providerQueries++;
        let results: SearchResult[] = [];
        try { results = await serperSearch(query); } catch (error) {
          if (providerQueries === 1) throw error;
          continue;
        }
        for (const result of results) {
          if (created.length >= remaining) break;
          found++;
          if (!result.link || !result.title) { insufficient++; continue; }
          const url = result.link;
          const urlDomain = domain(url);
          const socialInstagram = isSocial(url, "instagram.com") ? url : undefined;
          const base = {
            companyName: cleanCompanyName(result.title, url),
            location: settings.locations.find((l) => normalize((result.title||"")+" "+(result.snippet||"")).includes(normalize(l))) || "Nigeria",
            description: result.snippet || "",
            sourceUrl: url,
            source: "SERPER"
          };
          const identity = [normalize(base.companyName), urlDomain, socialId(socialInstagram)].filter(Boolean).join("|");
          if (seen.has(identity) || [...existing].some((x) => x && identity.includes(x))) { duplicate++; continue; }
          seen.add(identity);

          const enrichment = await enrich(url);
          const merged = { ...base, ...enrichment };
          const scoreData = scoreCandidate({
            title: result.title || "", snippet: result.snippet || "", url,
            location: base.location, industry: settings.industries[0],
            website: merged.website, instagram: merged.instagram, email: merged.email, phone: merged.phone
          });
          const quality = qualityFor(scoreData.score);
          const outreachReady = scoreData.score >= settings.minimumScore && Boolean(merged.instagram || merged.website || merged.email || merged.phone);
          if (!outreachReady) { rejected++; continue; }
          qualified++;
          const lead = await PersistentProspectService.create({
            companyName: merged.companyName,
            businessType: "REAL ESTATE",
            location: merged.location,
            description: merged.description,
            phone: merged.phone,
            whatsapp: merged.phone,
            email: merged.email,
            instagram: merged.instagram,
            website: merged.website,
            source: "LEAD_FINDER_SERPER",
            clientType: "AUTOMATED_DISCOVERY",
            serviceTier: quality
          }, user);
          await db.from("leads").update({
            discovery_score: scoreData.score,
            discovery_quality: quality,
            discovery_source: "SERPER",
            discovery_run_id: run.id,
            outreach_ready: true,
            updated_at: new Date().toISOString()
          }).eq("id", lead.id);
          created.push({ ...merged, score: scoreData.score, quality, outreachReady: true, breakdown: scoreData.breakdown });
        }
      }
      const status = created.length >= remaining ? "COMPLETED" : "PARTIAL";
      await db.from("lead_finder_runs").update({
        status, found_count: found, qualified_count: qualified, duplicate_count: duplicate,
        rejected_count: rejected, insufficient_count: insufficient, provider_queries: providerQueries,
        stats: { target, remainingBeforeRun: remaining, created: created.length, locations: settings.locations, industries: settings.industries },
        completed_at: new Date().toISOString()
      }).eq("id", run.id);
      const final = await this.getTodaySummary(user);
      return { ...final, created, runId: run.id, stats: { found, qualified, duplicate, rejected, insufficient, providerQueries } };
    } catch (error) {
      await db.from("lead_finder_runs").update({
        status: "FAILED", found_count: found, qualified_count: qualified, duplicate_count: duplicate,
        rejected_count: rejected, insufficient_count: insufficient, provider_queries: providerQueries,
        stats: { error: error instanceof Error ? error.message : String(error) },
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

  static async getHistory(limit = 20) {
    const db = getSupabaseClient();
    if (!db) return [];
    const { data } = await db.from("lead_finder_runs").select("*").order("created_at",{ascending:false}).limit(Math.min(50, limit));
    return data || [];
  }
}
