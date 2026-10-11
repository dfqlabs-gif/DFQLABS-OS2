import { getSupabaseClient } from "../config/supabase.js";
import { PersistentProspectService } from "./persistentProspectService.js";
import { normalizeSocialIdentifier } from "../utils/socialNormalizer.js";
import { User } from "../../shared/types/index.js";
import { SerperDiscoverySource } from "./discovery/serperSource.js";
import { OpenStreetMapDiscoverySource } from "./discovery/openStreetMapSource.js";
import { DirectoryDiscoverySource } from "./discovery/directorySource.js";
import { DiscoverySource, RawCandidate, SourceQueryResult } from "./discovery/types.js";
import { validateNigerianMobilePhone } from "../utils/phoneNormalizer.js";
import { CompanyIdentityResolver } from "./discovery/companyIdentityResolver.js";
import { PublicContactEnricher } from "./discovery/publicContactEnricher.js";

const DEFAULT_LOCATIONS = ["Abuja", "Kano", "Kaduna", "Jos", "Asaba", "Benin City", "Akwa Ibom"];
const SUPPLEMENTAL_NIGERIAN_MARKETS = ["Lagos", "Port Harcourt", "Ibadan", "Enugu", "Owerri", "Warri", "Uyo", "Calabar"];
const DEFAULT_INDUSTRIES = ["real estate developer", "luxury realtor", "real estate agency", "property investment company"];

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

export function isDirectoryCandidate(candidate: Pick<RawCandidate, "companyName" | "sourceTitle" | "sourceSnippet" | "description" | "sourceUrl" | "website" | "instagram" | "facebook" | "linkedin">): boolean {
  const hostOf = (value?: string) => {
    try { return new URL(value || "").hostname.toLowerCase().replace(/^www\\./, ""); } catch { return ""; }
  };
  const hosts = [candidate.sourceUrl, candidate.website].map(hostOf).filter(Boolean);
  const socialProfile = [candidate.instagram, candidate.facebook, candidate.linkedin, candidate.sourceUrl]
    .some((value) => /(?:^|\\.)instagram\\.com$|(?:^|\\.)facebook\\.com$|(?:^|\\.)linkedin\\.com$/i.test(hostOf(value)));
  const knownDirectoryHost = hosts.some((host) =>
    /(?:^|\\.)(?:businesslist\\.com\\.ng|finelib\\.com|vconnect\\.com|yellowpages\\.ng|businessdirectory\\.ng|nigeriapropertycentre\\.com|propertypro\\.ng)$/.test(host)
  );
  if (knownDirectoryHost && !socialProfile) return true;

  const title = normalize(candidate.sourceTitle || candidate.companyName);
  const evidence = normalize([candidate.sourceSnippet, candidate.description].filter(Boolean).join(" "));
  const directoryTitle = /^(?:list of (?:business|real estate|property) (?:companies|agencies|businesses)|real estate agencies in .{2,80}|list of business companies|property directory|business directory|company directory|directory of .+|top real estate companies(?: in .+)?)$/.test(title);
  const directoryEvidence = /\\b(?:this directory features a list of|business directory of|browse our (?:business )?directory|owners or professionals can list (?:their )?(?:business|property)|list of real estate agencies|list of real estate companies|directory page presents a list of)\\b/.test(evidence);
  // A social profile may use a call-to-action as its display name; resolve that profile identity instead of discarding it.
  return !socialProfile && (directoryTitle || directoryEvidence);
}

function isGenericCompanyName(value: string): boolean {
  const raw = normalize(value);
  const name = raw
    .replace(/[|–—-]/g, " ")
    .replace(/\b(nigeria|abuja|lagos|kano|kaduna|jos|asaba|benin city|akwa ibom)\b/g, " ")
    .replace(/\b(limited|ltd|plc|nigeria)\b/g, " ")
    .replace(/\bin\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!name || name.length < 4 || name.length > 110) return true;
  // Search results often return a listing title or a seller's sentence rather than a company identity.
  if (/^(?:please contact|contact|call|whatsapp|we are|we're|we offer|we deal|we are into|for more information|buy|sell|rent|looking for)\b/i.test(raw)) return true;
  if (/^(?:house|land|plot|apartment|flat|duplex|property|properties|home|building)\s+(?:for sale|for rent|to let|available)\b/i.test(raw)) return true;
  if (/\b(?:for sale|for rent|to let|please contact|for more information|call now|click here|available for rent)\b/i.test(raw)) return true;
  if (/\b(?:0[789][01]\d{8}|\+?234[789][01]\d{8})\b/.test(raw)) return true;
  if (/[!?]/.test(raw) || /\.\s+[A-Z]/.test(value)) return true;
  return /^(?:real estate|property|properties|realty|realtor|housing|estate|luxury real estate|real estate company|property company|real estate agency|property agency|real estate developer|property developer|real estate investment company|real estate companies|property companies|real estate agencies|property agencies|real estate developers|best real estate companies|top real estate companies|unknown real estate company)(?: in .*)?$/.test(name);
}
function qualityFor(score: number): Candidate["quality"] {
  if (score >= 90) return "EXCELLENT";
  if (score >= 80) return "HIGH";
  if (score >= 70) return "GOOD";
  return "MEDIUM";
}

export function scoreCandidate(input: { companyName: string; description: string; location: string; industry: string; website?: string; instagram?: string; email?: string; phone?: string }) {
  // Score evidence from the discovered business, not the search query. Including the
  // requested industry/location here would make every result appear relevant by default.
  const evidenceText = normalize([input.companyName, input.description].join(" ")).replace(/[_-]+/g, " ");
  const locationText = normalize(input.location);
  const industryFit = /\b(?:real estate|property|properties|realtor|realty|developer|development|homes|estate agent|housing|property management|brokerage)\b/i.test(evidenceText) ? 25 : 0;
  // Location is populated by the discovery source's market-specific search. Award geographic
  // relevance from that source context, but still require independent real-estate evidence above.
  const locationFit = /(nigeria|abuja|lagos|kano|kaduna|jos|asaba|benin|akwa ibom|delta|uyo|calabar|enugu|ibadan|owerri|warri|port harcourt)/i.test(evidenceText)
    || /(abuja|lagos|kano|kaduna|jos|asaba|benin city|akwa ibom|delta|uyo|calabar|enugu|ibadan|owerri|warri|port harcourt)/i.test(locationText) ? 10 : 0;
  const companyQuality = /(developer|luxury|premium|estate|group|holdings|investment|properties|realty|homes)/i.test(normalize(input.companyName)) ? 10 : 4;
  const digitalPresence = (input.website || input.instagram) ? 10 : 0;
  const contentOpportunity = input.instagram ? 10 : 5;
  const websiteOpportunity = input.website ? 4 : 8;
  const highTicket = /(luxury|premium|commercial|investment|developer|estate|off.?plan|high.?end)/i.test(evidenceText) ? 10 : 5;
  const contactability = (input.phone ? 10 : 0) + (input.email ? 5 : 0);
  const strategicFit = /nigeria|abuja|lagos|kano|kaduna|jos|asaba|benin|akwa ibom|delta|uyo|calabar|enugu|ibadan|owerri|warri|port harcourt/i.test(evidenceText)
    || /(abuja|lagos|kano|kaduna|jos|asaba|benin city|akwa ibom|delta|uyo|calabar|enugu|ibadan|owerri|warri|port harcourt)/i.test(locationText) ? 5 : 0;
  const breakdown = { industryFit, locationFit, companyQuality, digitalPresence, contentOpportunity, websiteOpportunity, highTicket, contactability, strategicFit };
  const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));
  return { score, breakdown, hasRealEstateEvidence: industryFit > 0 };
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
    return {
      dailyTarget: data.daily_target,
      minimumScore: data.minimum_score,
      locations: Array.isArray(data.locations) ? data.locations.filter((value: unknown): value is string => typeof value === "string") : DEFAULT_LOCATIONS,
      industries: Array.isArray(data.industries) ? data.industries.filter((value: unknown): value is string => typeof value === "string") : DEFAULT_INDUSTRIES,
      preferredContact: typeof data.preferred_contact === "string" ? data.preferred_contact : current.preferredContact
    };
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

  /** Persist a run before returning an accepted response to the client. */
  static async startRun(user: User, requestedTarget?: number) {
    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured.");
    const settings = await this.getSettings();
    const target = Math.max(1, Math.min(500, requestedTarget || settings.dailyTarget));
    const summary = await this.getTodaySummary(user);
    const remaining = target; // A manual scan must attempt its full requested batch; summary counts must not silently shrink it.
    const today = new Date().toISOString().slice(0, 10);
    const { data: running, error: runningError } = await db.from("lead_finder_runs").select("id,created_at").eq("run_date", today).eq("status", "RUNNING").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (runningError) throw new Error("Unable to check active Lead Finder runs: " + runningError.message);
    if (running) {
      const ageMs = Date.now() - new Date(running.created_at).getTime();
      if (ageMs <= 10 * 60 * 1000) throw new Error("A Lead Finder run is already in progress.");
      const { error } = await db.from("lead_finder_runs").update({ status: "FAILED", completed_at: new Date().toISOString(), stats: { recovery: "STALE_RUN_AUTO_RECOVERED", staleAfterMinutes: 10, statusMessage: "Recovered a stale run before starting a new scan." } }).eq("id", running.id).eq("status", "RUNNING");
      if (error) throw new Error("Unable to recover stale Lead Finder run: " + error.message);
    }
    const alreadyMet = remaining === 0;
    const stats = alreadyMet ? { target, created: 0, remainingBeforeRun: 0, priorQualifiedToday: summary.newQualifiedToday, statusMessage: "Today's qualified prospect target is already met." } : { target, remainingBeforeRun: remaining, priorQualifiedToday: summary.newQualifiedToday, discoveryProvider: "MULTI_SOURCE_INDEPENDENT", phase: "INITIALIZING", statusMessage: "Scan accepted. Preparing discovery providers..." };
    const { data: run, error: runError } = await db.from("lead_finder_runs").insert({ run_date: today, target, minimum_score: settings.minimumScore, requested_by_user_id: user.id, status: alreadyMet ? "COMPLETED" : "RUNNING", stats, ...(alreadyMet ? { completed_at: new Date().toISOString() } : {}) }).select("*").single();
    if (runError || !run) throw new Error(runError?.message || "Unable to create durable Lead Finder run.");
    return { run, alreadyMet, target, remaining };
  }
  static async runDaily(user: User, requestedTarget?: number, existingRunId?: string) {
    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured.");
    const settings = await this.getSettings();

    const target = Math.max(1, Math.min(500, requestedTarget || settings.dailyTarget));
    const summary = await this.getTodaySummary(user);
    const remaining = target; // Scan-level target, independent of stale or misclassified daily summary counts.
    if (remaining === 0 && !existingRunId) return { ...summary, created: [], message: "Today's qualified prospect target is already met." };

    let run: any;
    if (existingRunId) {
      const { data, error } = await db.from("lead_finder_runs").select("*").eq("id", existingRunId).eq("status", "RUNNING").single();
      if (error || !data) throw new Error(error?.message || "The accepted Lead Finder run is no longer active.");
      run = data;
    } else {
      const prepared = await this.startRun(user, requestedTarget);
      if (prepared.alreadyMet) return { ...summary, created: [], runId: prepared.run.id, status: "COMPLETED", message: "Today's qualified prospect target is already met." };
      run = prepared.run;
    }
    if (remaining === 0) {
      const { error } = await db.from("lead_finder_runs").update({ status: "COMPLETED", completed_at: new Date().toISOString(), stats: { target, created: 0, statusMessage: "Today's qualified prospect target is already met." } }).eq("id", run.id).eq("status", "RUNNING");
      if (error) throw new Error("Unable to finalize target-met Lead Finder run: " + error.message);
      return { ...summary, created: [], runId: run.id, status: "COMPLETED", message: "Today's qualified prospect target is already met." };
    }

    const sources: DiscoverySource[] = [
      new SerperDiscoverySource(),
      // Public directory search can yield contactable prospects without paid Serper credits.
      // Run it before OSM, whose public records often lack phone numbers and can be slow.
      new DirectoryDiscoverySource(),
      new OpenStreetMapDiscoverySource()
    ];
    const discoveryLocations = [...new Set([...settings.locations, ...SUPPLEMENTAL_NIGERIAN_MARKETS])];

    const existing = await this.existingIdentifiers();
    const seen = new Set<string>();
    const created: Candidate[] = [];
    let found = 0, qualified = 0, duplicate = 0, rejected = 0;
    const rejectionReasons: Record<string, number> = {
      genericCompanyName: 0, directoryPage: 0, invalidNigeriaPhone: 0, duplicateIdentity: 0, belowMinimumScore: 0, persistenceError: 0
    };

    const sourceStats: Record<string, SourceQueryResult> = {};

    for (const source of sources) {
      if (created.length >= remaining) break;

      const locationsForSource = source.name === "OPENSTREETMAP" ? settings.locations : discoveryLocations;
      for (const location of locationsForSource) {
        if (created.length >= remaining) break;

        const { error: progressStartError } = await db.from("lead_finder_runs").update({
          stats: { target, created: created.length, found, qualified, duplicate, rejected, rejectionReasons, sourceStats, phase: "DISCOVERY", currentProvider: source.name, currentLocation: location, statusMessage: "Searching " + location + " with " + source.name + "..." }
        }).eq("id", run.id).eq("status", "RUNNING");
        if (progressStartError) throw new Error("Unable to persist Lead Finder progress: " + progressStartError.message);
        const result = await source.discoverCandidates(location, settings.industries[0] || "real estate", 40);
        // Search snippets often omit contact details even when the business publishes a phone
        // number on its own public website/profile. Enrich candidates before the phone qualification gate.
        // Apply the directory-page gate to every provider (including Serper), not just the
        // public-directory provider. A directory is never itself an outreach prospect.
        const candidateResults = result.candidates.filter((candidate) => {
          if (!isDirectoryCandidate(candidate)) return true;
          found++;
          rejected++;
          rejectionReasons.directoryPage++;
          return false;
        });
        const enrichedCandidates = await PublicContactEnricher.enrich(candidateResults);
        // Resolve generic property-ad headlines against original source evidence before qualification.
        const resolvedCandidates = await CompanyIdentityResolver.resolve(enrichedCandidates, location);
        const resolvedResult = { ...result, candidates: resolvedCandidates };
        const priorStats = sourceStats[source.name];
        sourceStats[source.name] = priorStats ? {
          sourceName: source.name,
          attempted: priorStats.attempted || result.attempted,
          succeeded: priorStats.succeeded || result.succeeded,
          queriesCount: priorStats.queriesCount + result.queriesCount,
          candidates: [...priorStats.candidates, ...resolvedCandidates],
          errorCode: result.errorCode || priorStats.errorCode,
          errorMessage: result.errorMessage || priorStats.errorMessage,
          executionDurationMs: (priorStats.executionDurationMs || 0) + (result.executionDurationMs || 0)
        } : resolvedResult;
        const { error: progressEndError } = await db.from("lead_finder_runs").update({
          found_count: found, qualified_count: qualified, duplicate_count: duplicate, rejected_count: rejected,
          stats: { target, created: created.length, found, qualified, duplicate, rejected, rejectionReasons, sourceStats, phase: "QUALIFICATION", currentProvider: source.name, currentLocation: location, statusMessage: "Reviewed " + found + " candidates; " + created.length + " qualified prospects saved so far." }
        }).eq("id", run.id).eq("status", "RUNNING");
        if (progressEndError) throw new Error("Unable to persist Lead Finder provider progress: " + progressEndError.message);

        if (!result.succeeded) {
          console.warn(`[Lead Finder] Source ${source.name} failed:`, result.errorMessage);
          continue;
        }

        for (const candidate of resolvedCandidates) {
          if (created.length >= remaining) break;
          found++;

          const companyName = candidate.companyName.trim();
          const companyKey = normalize(companyName);
          const identityAssessment = candidate.rawTags?.identityAssessment as { status?: string; confidence?: number } | undefined;

          // A listing/ad headline is never allowed into the outreach-ready CRM as if it were a verified company.
          if (identityAssessment?.status === "UNRESOLVED") {
            rejectionReasons.genericCompanyName++;
            rejected++;
            continue;
          }

          if (isGenericCompanyName(companyName)) {
            rejectionReasons.genericCompanyName++;
            rejected++;
            continue;
          }

          if (!companyKey || existing.has(companyKey) || seen.has(companyKey)) {
            duplicate++;
            continue;
          }

          const phoneValidation = validateNigerianMobilePhone(candidate.phone);
          const validPhone = phoneValidation.isValid ? phoneValidation.normalized : undefined;

          if (!validPhone) {
            rejectionReasons.invalidNigeriaPhone++;
            rejected++;
            continue;
          }

          seen.add(companyKey);
          const identifiers = [validPhone, candidate.website ? domain(candidate.website) : "", candidate.instagram ? normalizeSocialIdentifier(candidate.instagram) : ""].filter(Boolean);

          if (identifiers.some((id) => existing.has(normalize(id)) || seen.has(normalize(id)))) {
            duplicate++;
            rejectionReasons.duplicateIdentity++;
            continue;
          }
          identifiers.forEach((id) => seen.add(normalize(id)));

          const scoreData = scoreCandidate({
            companyName,
            description: candidate.description || "",
            location: candidate.location || location,
            industry: settings.industries[0] || "real estate",
            website: candidate.website,
            instagram: candidate.instagram,
            email: candidate.email,
            phone: validPhone
          });

          // Hard qualification gates cannot be bypassed by a numerical score.
          if (!scoreData.hasRealEstateEvidence) {
            rejectionReasons.belowMinimumScore++;
            rejected++;
            continue;
          }

          if (scoreData.score < settings.minimumScore) {
            rejectionReasons.belowMinimumScore++;
            rejected++;
            continue;
          }

          const quality = qualityFor(scoreData.score);

          try {
            const lead = await PersistentProspectService.create({
              companyName,
              businessType: "REAL ESTATE",
              location: candidate.location || location,
              description: candidate.description || `Discovered via ${source.name} for ${companyName}.`,
              phone: validPhone,
              email: candidate.email,
              instagram: candidate.instagram,
              website: candidate.website,
              source: `LEAD_FINDER_${source.name}`,
              clientType: "AUTOMATED_DISCOVERY",
              serviceTier: quality
            }, user);

            const { error: discoveryUpdateError } = await db.from("leads").update({
              discovery_score: scoreData.score,
              discovery_quality: quality,
              discovery_source: source.name,
              discovery_provider: source.name,
              discovery_run_id: run.id,
              outreach_ready: true,
              identity_confidence: Math.round((identityAssessment?.confidence ?? 0) * 100),
              identity_signals: [
                candidate.sourceTitle ? { type: "SOURCE_TITLE", value: candidate.sourceTitle } : null,
                candidate.sourceSnippet ? { type: "SOURCE_SNIPPET", value: candidate.sourceSnippet.slice(0, 1200) } : null,
                identityAssessment?.status === "RESOLVED" ? { type: "IDENTITY_RESOLUTION", confidence: identityAssessment.confidence } : null
              ].filter(Boolean),
              discovery_evidence: {
                sourceUrl: candidate.sourceUrl || null,
                sourceTitle: candidate.sourceTitle || null,
                sourceSnippet: candidate.sourceSnippet || candidate.description || null,
                originalCompanyName: (candidate.rawTags?.identityAssessment as { originalCompanyName?: string } | undefined)?.originalCompanyName || companyName,
                identityAssessment: candidate.rawTags?.identityAssessment || null
              },
              updated_at: new Date().toISOString()
            }).eq("id", lead.id);

            if (discoveryUpdateError) {
              throw new Error(`Unable to persist Lead Finder metadata for lead ${lead.id}: ${discoveryUpdateError.message}`);
            }

            qualified++;
            created.push({
              companyName,
              location,
              description: candidate.description || "",
              website: candidate.website,
              instagram: candidate.instagram,
              email: candidate.email,
              phone: validPhone,
              sourceUrl: candidate.sourceUrl,
              source: source.name,
              score: scoreData.score,
              quality,
              outreachReady: true,
              breakdown: scoreData.breakdown
            });
          } catch {
            rejectionReasons.persistenceError++;
            rejected++;
          }
        }
      }
    }

    const anySourceSucceeded = Object.values(sourceStats).some((result) => result.succeeded);
    const finalStatus = created.length >= remaining ? "COMPLETED" : found > 0 ? "PARTIAL" : "FAILED";
    const statusMessage = finalStatus === "COMPLETED"
      ? "Qualified prospect target reached."
      : found > 0
        ? `Discovery finished with ${created.length} qualified prospects against the remaining target of ${remaining}.`
        : anySourceSucceeded
          ? "Discovery sources responded but returned no candidates. Try another location or run again later."
          : "All configured discovery sources failed or were unavailable. Review provider diagnostics before retrying.";

    const { error: finalUpdateError } = await db.from("lead_finder_runs").update({
      status: finalStatus, found_count: found, qualified_count: qualified, duplicate_count: duplicate, rejected_count: rejected,
      stats: { target, created: created.length, found, qualified, duplicate, rejected, rejectionReasons, sourceStats, phase: "FINISHED", failureCode: !anySourceSucceeded ? "ALL_PROVIDERS_UNAVAILABLE" : undefined, statusMessage },
      completed_at: new Date().toISOString()
    }).eq("id", run.id).eq("status", "RUNNING");
    if (finalUpdateError) throw new Error("Unable to persist final Lead Finder status: " + finalUpdateError.message);

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
        sourceStats
      }
    };
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

  static async cancelRun(user: User) {
    if (user.role !== "FOUNDER") throw new Error("Founder access required.");
    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured.");
    const today = new Date().toISOString().slice(0, 10);
    const { data: running } = await db.from("lead_finder_runs").select("id").eq("run_date", today).eq("status", "RUNNING").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!running) return { cancelled: false, message: "No active Lead Finder run." };
    const { error } = await db.from("lead_finder_runs").update({
      status: "FAILED",
      completed_at: new Date().toISOString(),
      stats: { cancellation: "FOUNDER_CANCELLED", statusMessage: "Stopped by Founder." }
    }).eq("id", running.id).eq("status", "RUNNING");
    if (error) throw new Error(error.message);
    return { cancelled: true, runId: running.id };
  }

  static async resetToday(user: User) {
    if (user.role !== "FOUNDER") throw new Error("Founder access required.");
    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured.");
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    // Resetting Lead Finder must never delete CRM leads. Prospects are real customer records,
    // not disposable scan artifacts. Clear today's run history only; keep CRM data intact.
    const today = start.toISOString().slice(0, 10);
    const { error: runError } = await db.from("lead_finder_runs").delete().eq("run_date", today);
    if (runError) throw new Error(runError.message);
    const settings = await this.getSettings();
    const { data: remainingLeads, error: countError } = await db.from("leads")
      .select("id")
      .eq("outreach_ready", true)
      .not("discovery_run_id", "is", null)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());
    if (countError) throw new Error(countError.message);
    const count = remainingLeads?.length || 0;
    return {
      ...settings,
      target: settings.dailyTarget,
      newQualifiedToday: count,
      remaining: Math.max(0, settings.dailyTarget - count),
      status: count >= settings.dailyTarget ? "TARGET_MET" : "READY",
      reset: true,
      deletedLeads: 0,
      message: "Run history cleared. Existing CRM leads were preserved and still count toward today's target."
    };
  }

  static async getHistory(limit = 20) {
    const db = getSupabaseClient();
    if (!db) return [];
    const { data } = await db.from("lead_finder_runs").select("*").order("created_at",{ascending:false}).limit(Math.min(50, limit));
    return data || [];
  }
}
