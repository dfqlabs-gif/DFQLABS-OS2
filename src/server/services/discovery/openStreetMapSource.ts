import { DiscoverySource, RawCandidate, SourceQueryResult } from "./types.js";

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: {
    name?: string;
    office?: string;
    shop?: string;
    phone?: string;
    "contact:phone"?: string;
    website?: string;
    "contact:website"?: string;
    "addr:city"?: string;
    "addr:state"?: string;
    "addr:street"?: string;
    "addr:full"?: string;
    description?: string;
    [key: string]: string | undefined;
  };
}

interface OverpassResponse {
  version?: number;
  generator?: string;
  elements?: OverpassElement[];
}

export class OpenStreetMapDiscoverySource implements DiscoverySource {
  public readonly name = "OPENSTREETMAP";

  private readonly endpoint = "https://overpass-api.de/api/interpreter";

  public isConfigured(): boolean {
    return true; // Publicly accessible Overpass API endpoint
  }

  private getCoordinatesForLocation(location: string): { lat: number; lon: number } {
    const coordsMap: Record<string, { lat: number; lon: number }> = {
      abuja: { lat: 9.0765, lon: 7.3986 },
      lagos: { lat: 6.5244, lon: 3.3792 },
      kano: { lat: 12.0022, lon: 8.5920 },
      kaduna: { lat: 10.5105, lon: 7.4165 },
      jos: { lat: 9.8965, lon: 8.8583 },
      asaba: { lat: 6.1983, lon: 6.7275 },
      "delta state": { lat: 6.1983, lon: 6.7275 },
      delta: { lat: 6.1983, lon: 6.7275 },
      "benin city": { lat: 6.3350, lon: 5.6037 },
      benin: { lat: 6.3350, lon: 5.6037 },
      "akwa ibom": { lat: 5.0377, lon: 7.9128 },
      uyo: { lat: 5.0377, lon: 7.9128 },
      "port harcourt": { lat: 4.8156, lon: 7.0498 }
    };
    const key = location.trim().toLowerCase();
    return coordsMap[key] || { lat: 9.0765, lon: 7.3986 };
  }

  public async discoverCandidates(location: string, _industry: string, maxResults = 20): Promise<SourceQueryResult> {
    const startTime = Date.now();
    const candidates: RawCandidate[] = [];

    const coords = this.getCoordinatesForLocation(location);

    // Construct Overpass QL query searching for estate agents and property management in target location
    const query = `
      [out:json][timeout:15];
      (
        node["office"="estate_agent"](around:35000, ${coords.lat}, ${coords.lon});
        way["office"="estate_agent"](around:35000, ${coords.lat}, ${coords.lon});
        node["shop"="estate_agent"](around:35000, ${coords.lat}, ${coords.lon});
        node["office"="property_management"](around:35000, ${coords.lat}, ${coords.lon});
      );
      out body;
    `;

    // Alternatively, search by area name if geocoding/area query is supported, or use area-based search
    const areaQuery = `
      [out:json][timeout:15];
      area["name"="${location}"]->.searchArea;
      (
        node["office"="estate_agent"](area.searchArea);
        node["shop"="estate_agent"](area.searchArea);
        node["office"="property_management"](area.searchArea);
      );
      out body;
    `;

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "DFQLABS-OS2-LeadFinder/2.0 (+https://dfqlabs.com.ng)"
        },
        body: `data=${encodeURIComponent(areaQuery)}`,
        signal: AbortSignal.timeout(12000)
      });
    } catch (error) {
      // Fallback query if area lookup failed or timed out
      try {
        response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "DFQLABS-OS2-LeadFinder/2.0 (+https://dfqlabs.com.ng)"
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(12000)
        });
      } catch (innerError) {
        return {
          sourceName: this.name,
          attempted: true,
          succeeded: false,
          queriesCount: 2,
          candidates: [],
          errorCode: "OSM_UNREACHABLE",
          errorMessage: innerError instanceof Error ? innerError.message : String(innerError),
          executionDurationMs: Date.now() - startTime
        };
      }
    }

    if (!response.ok) {
      return {
        sourceName: this.name,
        attempted: true,
        succeeded: false,
        queriesCount: 1,
        candidates: [],
        errorCode: `HTTP_${response.status}`,
        errorMessage: `Overpass API returned status ${response.status}`,
        executionDurationMs: Date.now() - startTime
      };
    }

    try {
      const data = (await response.json()) as OverpassResponse;
      const elements = data.elements || [];

      for (const el of elements) {
        if (candidates.length >= maxResults) break;
        const tags = el.tags || {};
        const companyName = tags.name?.trim();
        if (!companyName || companyName.length < 3) continue;

        const phone = tags.phone || tags["contact:phone"];
        const website = tags.website || tags["contact:website"];
        const addressParts = [tags["addr:full"], tags["addr:street"], tags["addr:city"], tags["addr:state"], location]
          .filter(Boolean)
          .join(", ");

        candidates.push({
          companyName,
          businessType: tags.office || tags.shop || "estate_agent",
          location: tags["addr:city"] || tags["addr:state"] || location,
          description: tags.description || `OpenStreetMap record for ${companyName} (${tags.office || tags.shop || "real estate"}) located at ${addressParts}.`,
          phone,
          website: website && !website.includes("openstreetmap.org") ? website : undefined,
          sourceFamily: "OPENSTREETMAP",
          sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
          sourceTitle: companyName,
          rawTags: tags
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
        errorCode: "OSM_PARSE_ERROR",
        errorMessage: error instanceof Error ? error.message : String(error),
        executionDurationMs: Date.now() - startTime
      };
    }
  }
}
