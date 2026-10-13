import {
  DuplicateCheckResult,
  FocusItem,
  Lead,
  LeadContact,
  LeadSocialProfile,
  Message,
  MissionControlMetrics,
  Outcome,
  OutreachSeat,
  User
} from "../../shared/types/index.js";

const API_BASE = "";
const AUTH_TOKEN_KEY = "dfqlabs-os2-token";

// Some mobile browsers and privacy modes can block persistent storage. Authentication
// must still work for the current page session when localStorage is unavailable.
function readStoredToken(): string {
  try { return window.localStorage.getItem(AUTH_TOKEN_KEY) || ""; }
  catch { return ""; }
}

function persistToken(token: string): void {
  try {
    if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    else window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Keep the in-memory session; storage persistence is best-effort on restricted browsers.
  }
}

export class ApiClient {
  private static token = readStoredToken();

  public static setAuthToken(token: string) {
    this.token = token;
    persistToken(token);
  }

  private static async request<T>(path: string, options: RequestInit & { skipAuth?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.skipAuth || !this.token ? {} : { Authorization: `Bearer ${this.token}` }),
      ...(options.headers as Record<string, string>)
    };

    // API responses are authoritative live state, not cacheable page assets.
    // Avoid conditional requests returning 304 to JSON callers and masking fresh run state.
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      cache: options.cache ?? "no-store",
      headers
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      let err: { detail?: string; title?: string; message?: string; status?: number } = {};
      try { err = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON response */ }
      const detail = err.detail || err.message || err.title || raw || `Request failed with status ${res.status}`;
      throw new Error(detail);
    }

    if (res.status === 204) return undefined as T;
    const responseText = await res.text();
    if (!responseText) return undefined as T;
    try {
      return JSON.parse(responseText) as T;
    } catch {
      const contentType = res.headers.get("content-type") || "unknown content type";
      const preview = responseText.replace(/\s+/g, " ").slice(0, 240);
      const looksLikeHtml = /text\/html/i.test(contentType) || /^\s*(?:<!doctype html|<html[\s>])/i.test(responseText);
      if (looksLikeHtml) {
        throw new Error(`The API returned an HTML page instead of JSON (HTTP ${res.status}). This usually indicates a deployment or routing mismatch. Response preview: ${preview}`);
      }
      throw new Error(`The server returned malformed JSON (HTTP ${res.status}; ${contentType}). Response preview: ${preview || "[empty]"}`);
    }
  }

  public static login(email: string, password: string): Promise<{ token: string; user: User; seat?: OutreachSeat }> {
    return this.request("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }), skipAuth: true } as RequestInit);
  }

  public static getHealth(): Promise<{ ok: boolean; service: string; timestamp: string }> {
    return this.request("/health");
  }

  public static getMe(): Promise<{ user: User; seat?: OutreachSeat }> {
    return this.request("/api/v1/auth/me");
  }

  public static checkDuplicate(payload: {
    phone?: string;
    whatsapp?: string;
    email?: string;
    social?: string;
    website?: string;
    company?: string;
  }): Promise<DuplicateCheckResult> {
    return this.request("/api/v1/prospects/duplicate-check", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  public static createProspect(payload: {
    companyName: string;
    contactName?: string;
    titleRole?: string;
    businessType?: string;
    location?: string;
    phone?: string;
    instagram?: string;
    website?: string;
    description?: string;
    email?: string;
    whatsapp?: string;
    clientType?: string;
    source?: string;
    serviceTier?: string;
  }): Promise<{ lead: Lead }> {
    return this.request("/api/v1/prospects", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  public static getProspects(query?: { search?: string; stage?: string; limit?: number; page?: number }): Promise<{ leads: Lead[]; total: number; page?: number; totalPages?: number }> {
    const params = new URLSearchParams();
    if (query?.search) params.append("search", query.search);
    if (query?.stage) params.append("stage", query.stage);
    params.append("limit", String(query?.limit ?? 100));
    params.append("page", String(query?.page ?? 1));
    return this.request(`/api/v1/prospects?${params.toString()}`);
  }

  public static exportProspects(): Promise<{ format: string; version: number; exportedAt: string; leads: Lead[] }> {
    return this.request("/api/v1/prospects/export");
  }

  public static importProspects(payload: unknown): Promise<{ imported: number; skipped: number; failed: number; errors: string[] }> {
    return this.request("/api/v1/prospects/import", { method: "POST", body: JSON.stringify(payload) });
  }
  public static getProspectDetail(
    id: string
  ): Promise<{ lead: Lead; contacts: LeadContact[]; socialProfiles: LeadSocialProfile[]; messages: Message[]; conversation?: { id: string } }> {
    return this.request(`/api/v1/prospects/${id}`);
  }

  public static updateProspect(id: string, payload: Record<string, unknown>): Promise<{ lead: Lead }> {
    return this.request(`/api/v1/prospects/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  }
  public static deleteProspect(id: string): Promise<void> {
    return this.request(`/api/v1/prospects/${id}`, { method: "DELETE" });
  }

  public static generateFirstTouch(leadId: string): Promise<{ message: Message }> {
    return this.request("/api/v1/messages/generate-first-touch", {
      method: "POST",
      body: JSON.stringify({ leadId })
    });
  }

  public static generateFollowUp(leadId: string): Promise<{ message: Message }> {
    return this.request("/api/v1/messages/generate-follow-up", {
      method: "POST",
      body: JSON.stringify({ leadId })
    });
  }

  public static logInboundReply(conversationId: string, content: string, sentAt?: string): Promise<{ message: Message }> {
    return this.request(`/api/v1/messages/conversations/${conversationId}/inbound`, {
      method: "POST",
      body: JSON.stringify({ content, sentAt })
    });
  }

  public static updateMessageDraft(id: string, editedContent: string): Promise<{ message: Message }> {
    return this.request(`/api/v1/messages/${id}`, {
      method: "PUT",
      body: JSON.stringify({ editedContent })
    });
  }

  public static openWhatsApp(id: string): Promise<{ message: Message; whatsappUrl: string }> {
    return this.request(`/api/v1/messages/${id}/whatsapp-open`, {
      method: "POST"
    });
  }

  public static confirmSent(id: string, finalContent: string): Promise<{ message: Message; leadStage: string }> {
    return this.request(`/api/v1/messages/${id}/confirm-sent`, {
      method: "POST",
      body: JSON.stringify({ finalContent })
    });
  }

  public static getTodayFocus(): Promise<{ focusItems: FocusItem[] }> {
    return this.request("/api/v1/focus/today");
  }

  public static getMissionControl(): Promise<{ metrics: MissionControlMetrics }> {
    return this.request("/api/v1/dashboard/mission-control");
  }

  public static getCeoDashboard(): Promise<any> {
    return this.request("/api/v1/dashboard/ceo");
  }

  public static recordOutcome(payload: { leadId: string; outcomeType: string; notes?: string }): Promise<{ outcome: Outcome }> {
    return this.request("/api/v1/outcomes", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  public static getTeam(): Promise<{ users: User[]; seats: OutreachSeat[] }> {
    return this.request("/api/v1/admin/team");
  }

  public static reassignSeat(seatId: string, newUserId: string): Promise<{ seat: OutreachSeat }> {
    return this.request("/api/v1/admin/seats/reassign", {
      method: "POST",
      body: JSON.stringify({ seatId, newUserId })
    });
  }  public static getLeadFinderSummary(): Promise<any> { return this.request("/api/v1/lead-finder/summary"); }
  public static getLeadFinderHistory(): Promise<{ runs: any[] }> { return this.request("/api/v1/lead-finder/history"); }
  public static approveRejectedLeadFinderCandidate(runId: string, candidateIndex: number, companyName?: string): Promise<{ success: boolean; leadId: string; companyName: string; contactSaved: boolean; phoneRejected: boolean }> { return this.request(`/api/v1/lead-finder/candidates/${encodeURIComponent(runId)}/${candidateIndex}/approve`, { method: "POST", body: JSON.stringify({ companyName }) }); }
  public static runLeadFinder(target?: number): Promise<any> { return this.request("/api/v1/lead-finder/run", { method: "POST", body: JSON.stringify({ target }) }); }
  public static cancelLeadFinder(): Promise<any> { return this.request("/api/v1/lead-finder/cancel", { method: "POST" }); }
  public static resetLeadFinderToday(): Promise<any> { return this.request("/api/v1/lead-finder/reset", { method: "POST" }); }
  public static getLeadFinderSettings(): Promise<any> { return this.request("/api/v1/lead-finder/settings"); }
  public static saveLeadFinderSettings(payload: any): Promise<any> { return this.request("/api/v1/lead-finder/settings", { method: "PUT", body: JSON.stringify(payload) }); }
}
