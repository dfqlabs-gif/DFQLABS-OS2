import { env } from "../../config/env.js";
import { DiscoverySource, RawCandidate, SourceQueryResult } from "./types.js";

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  primaryType?: string;
  types?: string[];
  googleMapsUri?: string;
  editorialSummary?: { text?: string };
}
interface PlacesResponse { places?: GooglePlace[]; nextPageToken?: string }

/**
 * Structured local-business discovery through Google Places API (New).
 * Requires GOOGLE_MAPS_API_KEY with Places API and billing enabled.
 * This searches business/place records, not generic web articles.
 */
export class GooglePlacesDiscoverySource implements DiscoverySource {
  public readonly name = "GOOGLE_PLACES";
  public isConfigured(): boolean { return Boolean(env.GOOGLE_MAPS_API_KEY?.trim()); }

  public async discoverCandidates(location: string, industry: string, maxResults = 20): Promise<SourceQueryResult> {
    const started = Date.now();
    const key = env.GOOGLE_MAPS_API_KEY?.trim();
    if (!key) return {
      sourceName: this.name, attempted: false, succeeded: false, queriesCount: 0, candidates: [],
      errorCode: "NOT_CONFIGURED", errorMessage: "GOOGLE_MAPS_API_KEY is not configured.",
      executionDurationMs: Date.now() - started
    };

    // The settings field may contain several industries; use them as a broad OR query.
    const industryTerms = [...new Set(industry.split(";").map((term) => term.trim()).filter(Boolean))];
    const industryQuery = industryTerms.length ? industryTerms.join(" OR ") : "real estate developers, realtors, property agencies";
    const queries = [
      `${industryQuery} in ${location}, Nigeria`,
      `real estate developers, property investment companies and property companies in ${location}, Nigeria`,
      `real estate agents, luxury realtors, estate surveyors and property management companies in ${location}, Nigeria`
    ];
    const candidates: RawCandidate[] = [];
    const seen = new Set<string>();
    const errors: string[] = [];
    let queriesCount = 0;
    for (const textQuery of queries) {
      if (candidates.length >= maxResults) break;
      queriesCount++;
      try {
        const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.primaryType,places.types,places.googleMapsUri,places.editorialSummary"
          },
          body: JSON.stringify({ textQuery, languageCode: "en", regionCode: "NG", pageSize: 20, maxResultCount: 20 }),
          signal: AbortSignal.timeout(12000)
        });
        if (!response.ok) {
          const detail = (await response.text()).slice(0, 300);
          errors.push(`HTTP ${response.status}: ${detail}`);
          continue;
        }
        const json = await response.json() as PlacesResponse;
        for (const place of json.places || []) {
          if (candidates.length >= maxResults) break;
          const name = place.displayName?.text?.trim();
          const id = place.id?.trim();
          if (!name || !id || seen.has(id)) continue;
          seen.add(id);
          const address = place.formattedAddress || location;
          const phone = place.nationalPhoneNumber || place.internationalPhoneNumber;
          candidates.push({
            companyName: name,
            businessType: place.primaryType || industry,
            location: address,
            description: place.editorialSummary?.text || `${name} is listed as a local business in ${address}. Google Places category: ${place.primaryType || (place.types || []).join(", ") || industry}.`,
            phone,
            website: place.websiteUri,
            sourceFamily: this.name,
            sourceUrl: place.googleMapsUri || (id ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(id)}` : undefined),
            sourceTitle: name,
            sourceSnippet: [address, place.primaryType, place.editorialSummary?.text].filter(Boolean).join(" | "),
            rawTags: { placeId: id, types: place.types || [], googleMapsUri: place.googleMapsUri }
          });
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    return {
      sourceName: this.name, attempted: true, succeeded: candidates.length > 0,
      queriesCount, candidates,
      errorCode: candidates.length ? undefined : "GOOGLE_PLACES_NO_RESULTS",
      errorMessage: candidates.length ? undefined : errors.join(" | ") || "Google Places returned no business records.",
      executionDurationMs: Date.now() - started
    };
  }
}
