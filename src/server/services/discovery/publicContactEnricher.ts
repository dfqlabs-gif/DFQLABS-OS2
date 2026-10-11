import { RawCandidate } from "./types.js";

const PHONE_PATTERN = /(?:\+?234[\s().-]*[789][01][\s().-]*\d{3}[\s().-]*\d{4}|0[789][01][\s().-]*\d{3}[\s().-]*\d{4})/g;
const BLOCKED_HOST = /(?:^|\.)(?:instagram|facebook|linkedin|tiktok|youtube|google|bing|duckduckgo|twitter|x|whatsapp)\.com$/i;

function normalizePhone(raw: string): string {
  const compact = raw.replace(/[\s().-]/g, "");
  if (compact.startsWith("+234")) return "0" + compact.slice(4);
  if (compact.startsWith("234")) return "0" + compact.slice(3);
  return compact;
}

function extractPhone(html: string): string | undefined {
  const visible = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const telLinks = [...visible.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)].map((m) => m[1]);
  const matches = [...telLinks, ...(visible.match(PHONE_PATTERN) || [])];
  for (const match of matches) {
    const normalized = normalizePhone(match);
    if (/^0[789][01]\d{8}$/.test(normalized)) return normalized;
  }
  return undefined;
}

function pageUrl(candidate: RawCandidate): string | undefined {
  for (const value of [candidate.website, candidate.sourceUrl]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol) || BLOCKED_HOST.test(url.hostname)) continue;
      if (/(?:google|bing|duckduckgo|search\?q=)/i.test(url.hostname + url.pathname)) continue;
      return url.toString();
    } catch { /* Ignore malformed source URLs. */ }
  }
  return undefined;
}

export class PublicContactEnricher {
  static async enrich(candidates: RawCandidate[]): Promise<RawCandidate[]> {
    const pending = candidates
      .map((candidate, index) => ({ candidate, index, url: candidate.phone ? undefined : pageUrl(candidate) }))
      .filter((item): item is { candidate: RawCandidate; index: number; url: string } => Boolean(item.url))
      .slice(0, 24);
    const output = [...candidates];
    const concurrency = 6;
    for (let offset = 0; offset < pending.length; offset += concurrency) {
      const batch = pending.slice(offset, offset + concurrency);
      await Promise.all(batch.map(async ({ candidate, index, url }) => {
        try {
          const response = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; DFQLABSLeadFinder/2.0; +https://dfqlabs.com.ng)" },
            signal: AbortSignal.timeout(4500),
            redirect: "follow"
          });
          if (!response.ok) return;
          const contentType = response.headers.get("content-type") || "";
          if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) return;
          const html = (await response.text()).slice(0, 1_500_000);
          const phone = extractPhone(html);
          if (phone) output[index] = { ...candidate, phone };
        } catch {
          // Public websites can block automated requests; retain the original candidate and continue.
        }
      }));
    }
    return output;
  }
}
