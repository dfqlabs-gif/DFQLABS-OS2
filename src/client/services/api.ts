import {
  DuplicateCheckResult,
  FocusItem,
  Lead,
  Message,
  MissionControlMetrics,
  Outcome,
  OutreachSeat,
  User
} from "../../shared/types/index.js";

const API_BASE = "";

export class ApiClient {
  private static token = localStorage.getItem("dfqlabs-os2-token") || "";

  public static setAuthToken(token: string) {
    this.token = token;
    if (token) localStorage.setItem("dfqlabs-os2-token", token); else localStorage.removeItem("dfqlabs-os2-token");
  }

  private static async request<T>(path: string, options: RequestInit & { skipAuth?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.skipAuth || !this.token ? {} : { Authorization: `Bearer ${this.token}` }),
      ...(options.headers as Record<string, string>)
    };

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      let err: { detail?: string; title?: string; message?: string; status?: number } = {};
      try { err = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON response */ }
      const detail = err.detail || err.message || err.title || raw || `Request failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
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

  public static getProspects(query?: { search?: string; stage?: string }): Promise<{ leads: Lead[]; total: number }> {
    const params = new URLSearchParams();
    if (query?.search) params.append("search", query.search);
    if (query?.stage) params.append("stage", query.stage);
    return this.request(`/api/v1/prospects?${params.toString()}`);
  }

  public static getProspectDetail(
    id: string
  ): Promise<{ lead: Lead; contacts: unknown[]; socialProfiles: unknown[]; messages: Message[] }> {
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
  public static runLeadFinder(target?: number): Promise<any> { return this.request("/api/v1/lead-finder/run", { method: "POST", body: JSON.stringify({ target }) }); }
  public static resetLeadFinderToday(): Promise<any> { return this.request("/api/v1/lead-finder/reset", { method: "POST" }); }
  public static getLeadFinderSettings(): Promise<any> { return this.request("/api/v1/lead-finder/settings"); }
  public static saveLeadFinderSettings(payload: any): Promise<any> { return this.request("/api/v1/lead-finder/settings", { method: "PUT", body: JSON.stringify(payload) }); }
}
