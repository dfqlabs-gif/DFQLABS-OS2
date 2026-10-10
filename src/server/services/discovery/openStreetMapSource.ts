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

  private readonly endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter"
  ];

  public isConfigured(): boolean {
    return true; // Publicly accessible Overpass API endpoint
  }

  private getCoordinatesForLocation(location: string): { lat: number; lon: number } | undefined {
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
    return coordsMap[key];
  }

  public async discoverCandidates(location: string, _industry: string, maxResults = 20): Promise<SourceQueryResult> {
    const startTime = Date.now();
    const candidates: RawCandidate[] = [];

    const coords = this.getCoordinatesForLocation(location);

    // Construct Overpass QL query searching for estate agents and property management in target location
    const query = coords ? `
      [out:json][timeout:15];
      (
        node["office"="estate_agent"](around:35000, ${coords.lat}, ${coords.lon});
        way["office"="estate_agent"](around:35000, ${coords.lat}, ${coords.lon});
        node["shop"="estate_agent"](around:35000, ${coords.lat}, ${coords.lon});
        node["office"="property_management"](around:35000, ${coords.lat}, ${coords.lon});
      );
      out body;
    ` : "";

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

    let response: Response | undefined;
    let lastNetworkError: unknown;
    let queriesCount = 0;
    const request = async (endpoint: string, ql: string) => fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "DFQLABS-OS2-LeadFinder/2.0 (+https://dfqlabs.com.ng)"
      },
      body: `data=${encodeURIComponent(ql)}`,
      signal: AbortSignal.timeout(12000)
    });

    // Try multiple independent public Overpass instances. Render may be unable
    // to reach one host even when the others remain available.
    const requestAcrossEndpoints = async (ql: string) => {
      for (const endpoint of this.endpoints) {
        try {
          queriesCount++;
          const candidateResponse = await request(endpoint, ql);
          // Treat rate limits, server overload and gateway errors as endpoint
          // failures so another independent public instance gets a chance.
          if ([408, 429, 500, 502, 503, 504].includes(candidateResponse.status)) {
            lastNetworkError = new Error(`Overpass endpoint returned HTTP ${candidateResponse.status}`);
            continue;
          }
          return candidateResponse;
        } catch (error) {
          lastNetworkError = error;
        }
      }
      return undefined;
    };

    // Known target cities use a bounded-radius coordinate query first. This
    // avoids spending up to six requests per location on an area lookup plus a
    // coordinate fallback, which made scans unnecessarily long and fragile.
    // Unknown locations use area-name discovery only; never redirect them to Abuja.
    response = coords
      ? await requestAcrossEndpoints(query)
      : await requestAcrossEndpoints(areaQuery);

    if (!response) {
      return {
        sourceName: this.name,
        attempted: true,
        succeeded: false,
        queriesCount,
        candidates: [],
        errorCode: coords ? "OSM_UNREACHABLE" : "OSM_LOCATION_UNSUPPORTED",
        errorMessage: coords
          ? `All configured Overpass endpoints were unreachable. Last error: ${lastNetworkError instanceof Error ? lastNetworkError.message : String(lastNetworkError || "unknown network error")}`
          : `Area-name discovery failed and no coordinate fallback is configured for "${location}". Last error: ${lastNetworkError instanceof Error ? lastNetworkError.message : String(lastNetworkError || "unknown network error")}`,
        executionDurationMs: Date.now() - startTime
      };
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
