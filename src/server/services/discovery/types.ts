export interface RawCandidate {
  companyName: string;
  businessType?: string;
  location: string;
  description?: string;
  phone?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  email?: string;
  sourceFamily: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceSnippet?: string;
  rawTags?: Record<string, unknown>;
}

export interface SourceQueryResult {
  sourceName: string;
  attempted: boolean;
  succeeded: boolean;
  queriesCount: number;
  candidates: RawCandidate[];
  errorCode?: string;
  errorMessage?: string;
  executionDurationMs?: number;
}

export interface DiscoverySource {
  readonly name: string;
  isConfigured(): boolean;
  discoverCandidates(location: string, industry: string, maxResults?: number): Promise<SourceQueryResult>;
}
