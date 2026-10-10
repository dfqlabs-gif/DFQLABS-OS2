import { DiscoverySource, RawCandidate, SourceQueryResult } from "./types.js";

export class DirectoryDiscoverySource implements DiscoverySource {
  public readonly name = "PUBLIC_DIRECTORY";

  public isConfigured(): boolean {
    return true; // Public directory adapter
  }

  public async discoverCandidates(location: string, industry: string, maxResults = 10): Promise<SourceQueryResult> {
    const startTime = Date.now();
    const candidates: RawCandidate[] = [];

    // Public Nigerian business directory adapter query using duckduckgo/public html search or open directory indexing endpoint
    const query = `site:ng.businesslist.com OR site:vconnect.com OR site:finelib.com "${location}" "${industry}" "real estate"`;

    try {
      const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        return {
          sourceName: this.name,
          attempted: true,
          succeeded: false,
          queriesCount: 1,
          candidates: [],
          errorCode: `HTTP_${response.status}`,
          errorMessage: `Public directory search returned HTTP ${response.status}`,
          executionDurationMs: Date.now() - startTime
        };
      }

      const html = await response.text();
      const cleanText = (value: string) => value
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\\s+/g, " ")
        .trim();
      const links = [...html.matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\\s\\S]*?)<\\/a>/gi)];
      const snippets = [...html.matchAll(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\\s\\S]*?)<\\/a>/gi)];

      for (let i = 0; i < links.length && candidates.length < maxResults; i++) {
        const linkMatch = links[i];
        const title = cleanText(linkMatch[2] || "");
        const snippet = cleanText(snippets[i]?.[1] || "");
        let url = (linkMatch[1] || "").replace(/&amp;/g, "&");
        try {
          const parsed = new URL(url.startsWith("//") ? `https:${url}` : url);
          if (/duckduckgo\\.com$/i.test(parsed.hostname) && parsed.searchParams.has("uddg")) {
            url = parsed.searchParams.get("uddg") || "";
          } else if (url.startsWith("//")) {
            url = `https:${url}`;
          }
        } catch {
          continue;
        }
        if (!title || !url || !/^https?:\\/\\//i.test(url)) continue;

        const text = `${title} ${snippet}`;
        const phoneMatch = text.match(/(?:\\+?234|0)[789][01]\\d{8}\\b/);
        candidates.push({
          companyName: title.split(/\\s[|–—-]\\s/)[0].trim(),
          businessType: industry,
          location,
          description: snippet,
          phone: phoneMatch ? phoneMatch[0] : undefined,
          sourceFamily: "PUBLIC_DIRECTORY",
          sourceUrl: url,
          sourceTitle: title,
          sourceSnippet: snippet
        });
      }

      return {
        sourceName: this.name,
        attempted: true,
        succeeded: true,
        queriesCount: 1,
        candidates,
        executionDurationMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        sourceName: this.name,
        attempted: true,
        succeeded: false,
        queriesCount: 1,
        candidates: [],
        errorCode: "DIRECTORY_FETCH_FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
        executionDurationMs: Date.now() - startTime
      };
    }
  }
}
