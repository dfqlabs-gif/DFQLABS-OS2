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

      if (response.ok) {
        const html = await response.text();
        // Simple regex extraction for public directory search results
        const matches = [...html.matchAll(/<a class="result__url" href="([^"]+)">[\s\S]*?<a class="result__snippet[^"]*">([\s\S]*?)<\/a>/g)];

        for (const match of matches) {
          if (candidates.length >= maxResults) break;
          const url = match[1]?.trim();
          const rawSnippet = match[2]?.replace(/<[^>]+>/g, "").trim();
          if (!url || !rawSnippet) continue;

          // Attempt to extract title/company name
          const titleMatch = rawSnippet.match(/^([^.-]+)/);
          const companyName = titleMatch ? titleMatch[1].trim() : "Directory Listing";

          const phoneMatch = rawSnippet.match(/(?:\+?234|0)[789][01]\d{8}\b/);

          if (companyName.length >= 3 && !companyName.toLowerCase().includes("duckduckgo")) {
            candidates.push({
              companyName,
              businessType: industry,
              location,
              description: rawSnippet,
              phone: phoneMatch ? phoneMatch[0] : undefined,
              sourceFamily: "PUBLIC_DIRECTORY",
              sourceUrl: url,
              sourceTitle: `${companyName} - Directory`,
              sourceSnippet: rawSnippet
            });
          }
        }
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
