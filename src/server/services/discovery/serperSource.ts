import { DiscoverySource, RawCandidate, SourceQueryResult } from "./types.js";

type SearchResult = { title?: string; link?: string; snippet?: string };

export class SerperDiscoverySource implements DiscoverySource {
  public readonly name = "SERPER";

  public isConfigured(): boolean {
    return Boolean(process.env.SERPER_API_KEY?.trim());
  }

  private isSerperCreditExhausted(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      /serper.*(?:not enough credits|insufficient credits|out of credits|credit balance)|(?:not enough credits|insufficient credits|out of credits|credit balance).*serper/i.test(message) ||
      /HTTP 400:\s*Not enough credits/i.test(message)
    );
  }

  private async search(query: string, num = 10): Promise<SearchResult[]> {
    const key = process.env.SERPER_API_KEY?.trim();
    if (!key) {
      throw new Error("Serper API key is not configured.");
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
      throw new Error(`Serper search provider is unreachable: ${error instanceof Error ? error.message : String(error)}`);
    }

    const raw = await response.text();
    let json: { organic?: SearchResult[]; message?: string; error?: string } = {};
    try {
      json = raw ? (JSON.parse(raw) as typeof json) : {};
    } catch {
      json = {};
    }

    if (!response.ok) {
      const providerMessage = json.message || json.error;
      throw new Error(`Serper search provider failed with HTTP ${response.status}${providerMessage ? `: ${providerMessage}` : ""}`);
    }

    if (!Array.isArray(json.organic)) {
      throw new Error("Serper search provider returned an invalid response.");
    }

    return json.organic;
  }

  public async discoverCandidates(location: string, industry: string, maxResults = 15): Promise<SourceQueryResult> {
    const startTime = Date.now();
    if (!this.isConfigured()) {
      return {
        sourceName: this.name,
        attempted: false,
        succeeded: false,
        queriesCount: 0,
        candidates: [],
        errorCode: "NOT_CONFIGURED",
        errorMessage: "SERPER_API_KEY is missing.",
        executionDurationMs: Date.now() - startTime
      };
    }

    const queryTemplates = [
      `"${location}" Nigeria "${industry}" company official website contact phone`,
      `site:instagram.com "${location}" Nigeria ("${industry}" OR property OR developer)`
    ];

    const candidates: RawCandidate[] = [];
    let queriesExecuted = 0;

    try {
      for (const query of queryTemplates) {
        if (candidates.length >= maxResults) break;
        queriesExecuted++;
        const results = await this.search(query, 10);
        for (const res of results) {
          if (!res.title || !res.link) continue;

          // Extract public telephone numbers from search snippet or title
          const text = `${res.title} ${res.snippet || ""}`;
          const phoneMatch = text.match(/(?:\+?234|0)[789][01]\d{8}\b/);

          candidates.push({
            companyName: res.title.split(/\s[|–—-]\s/)[0].trim(),
            businessType: industry,
            location,
            description: res.snippet || "",
            phone: phoneMatch ? phoneMatch[0] : undefined,
            website: !res.link.includes("instagram.com") ? res.link : undefined,
            instagram: res.link.includes("instagram.com") ? res.link : undefined,
            sourceFamily: "SERPER",
            sourceUrl: res.link,
            sourceTitle: res.title,
            sourceSnippet: res.snippet
          });
        }
      }

      return {
        sourceName: this.name,
        attempted: true,
        succeeded: true,
        queriesCount: queriesExecuted,
        candidates,
        executionDurationMs: Date.now() - startTime
      };
    } catch (error) {
      const isExhausted = this.isSerperCreditExhausted(error);
      return {
        sourceName: this.name,
        attempted: true,
        succeeded: false,
        queriesCount: queriesExecuted,
        candidates,
        errorCode: isExhausted ? "SERPER_CREDITS_EXHAUSTED" : "SERPER_ERROR",
        errorMessage: error instanceof Error ? error.message : String(error),
        executionDurationMs: Date.now() - startTime
      };
    }
  }
}
