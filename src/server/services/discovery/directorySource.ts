import { DiscoverySource, RawCandidate, SourceQueryResult } from "./types.js";

type SearchResultLink = { url: string; title: string; snippet: string };

function cleanText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeCompanyIdentity(title: string): boolean {
  const value = title.trim();
  const normalized = value.toLowerCase().replace(/\s+/g, " ");
  if (value.length < 4 || value.length > 110) return false;
  if (/^(?:please contact|contact|call|whatsapp|we are|we're|we offer|we deal|we are into|for more information|buy|sell|rent|looking for)\b/i.test(normalized)) return false;
  if (/^(?:house|land|plot|apartment|flat|duplex|property|properties|home|building)\s+(?:for sale|for rent|to let|available)\b/i.test(normalized)) return false;
  if (/\b(?:for sale|for rent|to let|please contact|for more information|call now|click here|available for rent)\b/i.test(normalized)) return false;
  if (/\b(?:0[789][01]\d{8}|\+?234[789][01]\d{8})\b/.test(normalized)) return false;
  if (/[!?]/.test(value)) return false;
  return true;
}

function extractLinks(html: string): SearchResultLink[] {
  const links = [...html.matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const snippets = [...html.matchAll(/<(?:a|div|span)[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/gi)];
  const results: SearchResultLink[] = [];
  for (let i = 0; i < links.length; i++) {
    const title = cleanText(links[i][2] || "");
    let url = (links[i][1] || "").replace(/&amp;/g, "&");
    try {
      const parsed = new URL(url.startsWith("//") ? `https:${url}` : url);
      if (/duckduckgo\.com$/i.test(parsed.hostname) && parsed.searchParams.has("uddg")) {
        url = parsed.searchParams.get("uddg") || "";
      } else if (url.startsWith("//")) {
        url = `https:${url}`;
      }
    } catch {
      continue;
    }
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;
    results.push({ url, title, snippet: cleanText(snippets[i]?.[1] || "") });
  }
  return results;
}

export class DirectoryDiscoverySource implements DiscoverySource {
  public readonly name = "PUBLIC_DIRECTORY";

  public isConfigured(): boolean {
    return true;
  }

  public async discoverCandidates(location: string, industry: string, maxResults = 40): Promise<SourceQueryResult> {
    const startTime = Date.now();
    const candidates: RawCandidate[] = [];
    const seenUrls = new Set<string>();
    const queryTemplates = [
      `"${location}" Nigeria real estate company contact phone WhatsApp`,
      `"${location}" property developers real estate agency contact phone Nigeria`,
      `site:instagram.com "${location}" ("real estate" OR realtor OR property) Nigeria contact`,
      `site:finelib.com OR site:businesslist.com.ng OR site:vconnect.com "${location}" real estate property contact`
    ];
    const errors: string[] = [];
    let successfulQueries = 0;

    const queryResults = await Promise.all(queryTemplates.map(async (query) => {
      try {
        const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
          },
          signal: AbortSignal.timeout(7000)
        });
        if (!response.ok) {
          errors.push(`HTTP ${response.status}`);
          return null;
        }
        successfulQueries++;
        return await response.text();
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        return null;
      }
    }));

    for (const html of queryResults) {
      if (!html || candidates.length >= maxResults) continue;
      for (const result of extractLinks(html)) {
        if (candidates.length >= maxResults) break;
        if (!looksLikeCompanyIdentity(result.title)) continue;
        let parsedUrl: URL;
        try { parsedUrl = new URL(result.url); } catch { continue; }
        if (/^(?:html\.)?duckduckgo\.com$/i.test(parsedUrl.hostname)) continue;
        const canonicalUrl = `${parsedUrl.protocol}//${parsedUrl.hostname.toLowerCase()}${parsedUrl.pathname.replace(/\/$/, "")}`;
        if (seenUrls.has(canonicalUrl)) continue;
        seenUrls.add(canonicalUrl);

        const text = `${result.title} ${result.snippet}`;
        const phoneMatch = text.match(/(?:\+?234|0)[789][01]\d{8}\b/);
        const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
        const isInstagram = host === "instagram.com" || host.endsWith(".instagram.com");
        const isFacebook = host === "facebook.com" || host.endsWith(".facebook.com");
        const isLinkedIn = host === "linkedin.com" || host.endsWith(".linkedin.com");
        const isSocial = isInstagram || isFacebook || isLinkedIn;
        const isDirectory = /(?:businesslist|vconnect|finelib)\./i.test(host);

        candidates.push({
          companyName: result.title.split(/\s[|–—-]\s/)[0].trim(),
          businessType: industry,
          location,
          description: result.snippet,
          phone: phoneMatch ? phoneMatch[0] : undefined,
          website: !isSocial && !isDirectory ? result.url : undefined,
          instagram: isInstagram ? result.url : undefined,
          facebook: isFacebook ? result.url : undefined,
          linkedin: isLinkedIn ? result.url : undefined,
          sourceFamily: "PUBLIC_DIRECTORY",
          sourceUrl: result.url,
          sourceTitle: result.title,
          sourceSnippet: result.snippet
        });
      }
    }

    const queriesCount = queryTemplates.length;
    if (successfulQueries === 0) {
      return {
        sourceName: this.name,
        attempted: true,
        succeeded: false,
        queriesCount,
        candidates: [],
        errorCode: "DIRECTORY_FETCH_FAILED",
        errorMessage: errors.slice(0, 3).join("; ") || "All public directory queries failed.",
        executionDurationMs: Date.now() - startTime
      };
    }

    return {
      sourceName: this.name,
      attempted: true,
      succeeded: true,
      queriesCount,
      candidates,
      ...(candidates.length === 0 ? { errorCode: "NO_CANDIDATES", errorMessage: "Public search responded but returned no identifiable company candidates." } : {}),
      executionDurationMs: Date.now() - startTime
    };
  }
}
