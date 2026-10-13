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
    const industryTerms = [...new Set(industry.split(";").map((term) => term.trim()).filter(Boolean))];
    const industryQuery = industryTerms.length
      ? "(" + industryTerms.map((term) => "\"" + term.replace(/\"/g, "") + "\"").join(" OR ") + ")"
      : '("real estate" OR realtor OR property OR developer)';
    const queryTemplates = [
      `"${location}" Nigeria ${industryQuery} company official website contact phone WhatsApp`,
      `"${location}" Nigeria property developer real estate agency company phone contact details`,
      `site:instagram.com "${location}" Nigeria ("real estate" OR realtor OR property OR homes OR developer) contact phone`,
      `site:facebook.com "${location}" Nigeria real estate property developer agency contact`,
      `site:finelib.com OR site:businesslist.com.ng OR site:vconnect.com "${location}" real estate property company phone`,
      `"${location}" Nigeria "real estate" ("Ltd" OR "Limited" OR "Homes" OR "Properties" OR "Holdings" OR "Investment") phone`
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
        // Preserve ambiguous titles when their snippet or social profile can identify the publisher,
        // but reject obvious property-ad headlines that contain no company identity evidence at all.
        let parsedUrl: URL;
        try { parsedUrl = new URL(result.url); } catch { continue; }
        if (/^(?:html\.)?duckduckgo\.com$/i.test(parsedUrl.hostname)) continue;
        const resultHost = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
        const socialProfile = /^(?:instagram|facebook|linkedin)\.com$/.test(resultHost) || /\.(?:instagram|facebook|linkedin)\.com$/.test(resultHost);
        const directoryHost = /(?:^|\.)(?:businesslist\.com\.ng|finelib\.com|vconnect\.com|yellowpages\.ng|businessdirectory\.ng)$/i.test(resultHost);
        const directoryContent = /\b(?:business directory|company directory|directory features a list|list of real estate agencies|list of real estate companies|real estate agencies in .{2,50},? nigeria|list your property|owners or professionals can list|browse (?:our )?directory|find companies listed)\b/i.test(`${result.title} ${result.snippet}`);
        // Do not create CRM prospects for a directory itself. This source currently does not
        // reliably parse individual agency records from directory pages, so those pages are
        // evidence sources at most—not outreach targets.
        if (directoryHost || (directoryContent && !socialProfile)) continue;
        const obviousListingTitle = /^(?:verified\s+)?(?:house|land|plot|apartment|flat|duplex|property|properties|home|building|two[- ]storey|two[- ]story)\b/i.test(result.title)
          || /\b(?:for sale|for rent|to let|land listings?|property listings?|two[- ]storey|two[- ]story)\b/i.test(result.title);
        const publisherEvidence = /\b(?:limited|ltd\.?|plc|homes?|realty|properties|estates?|developers?|realtors?|shelters|holdings|ventures|group)\b/i.test(result.snippet);
        if (obviousListingTitle && !publisherEvidence && !socialProfile) continue;
        const canonicalUrl = `${parsedUrl.protocol}//${parsedUrl.hostname.toLowerCase()}${parsedUrl.pathname.replace(/\/$/, "")}`;
        if (seenUrls.has(canonicalUrl)) continue;
        seenUrls.add(canonicalUrl);

        const text = `${result.title} ${result.snippet}`;
        const phoneMatch = text.match(/(?:\+?234[\s().-]*[789][01](?:[\s().-]*\d){8}|0[\s().-]*[789][01](?:[\s().-]*\d){8})/);
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
