import { Request, Response } from "express";
import { AIEngineService } from "../services/aiEngine.js";
import { DuplicateEngine } from "../services/duplicateEngine.js";
import { EventService } from "../services/eventService.js";
import { LeadService } from "../services/leadService.js";
import { PersistentProspectService } from "../services/persistentProspectService.js";

export class ProspectController {
  public static async duplicateCheck(req: Request, res: Response): Promise<void> {
    const existingLeads = LeadService.getAllLeads(req.user);
    const persistentResult = PersistentProspectService.available()
      ? await PersistentProspectService.duplicateCheck(req.body, req.user!)
      : null;
    const result = persistentResult ?? DuplicateEngine.checkForDuplicate(req.body, existingLeads);

    if (req.user) {
      EventService.logEvent({
        eventType: "DUPLICATE_CHECKED",
        actorUserId: req.user.id,
        payload: { matchType: result.matchType, query: req.body }
      });
    }

    res.status(200).json(result);
  }

  public static async create(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }

    const lead = PersistentProspectService.available()
      ? await PersistentProspectService.create(req.body, req.user)
      : await LeadService.createLead(req.body, req.user);
    res.status(201).json({ lead });
  }

  public static async list(req: Request, res: Response): Promise<void> {
    if (PersistentProspectService.available() && req.user) {
      const result = await PersistentProspectService.list(req.user, {
        search: req.query.search as string,
        stage: req.query.stage as string,
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 25)
      });
      if (result) { res.status(200).json(result); return; }
    }
    const leads = LeadService.getAllLeads(req.user);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Number(req.query.limit || 25));
    const search = ((req.query.search as string) || "").toLowerCase();
    let filtered = leads.filter(l => !search || l.companyName.toLowerCase().includes(search) || l.contactName?.toLowerCase().includes(search) || l.location?.toLowerCase().includes(search));
    const stage = req.query.stage as string;
    if (stage) filtered = filtered.filter(l => l.pipelineStage === stage);
    res.status(200).json({ leads: filtered.slice((page-1)*limit, page*limit), total: filtered.length, page, totalPages: Math.ceil(filtered.length/limit) || 1 });
  }

  public static async getById(req: Request, res: Response): Promise<void> {
    if (PersistentProspectService.available() && req.user) {
      const result = await PersistentProspectService.getById(req.params.id, req.user);
      if (result) { res.status(200).json(result); return; }
    }

    const lead = LeadService.getLeadById(req.params.id, req.user);
    if (!lead) {
      res.status(404).json({
        type: "https://dfqlabs.com/errors/not-found",
        title: "Lead Not Found",
        status: 404,
        detail: `No lead found with ID ${req.params.id}`
      });
      return;
    }

    const conv = LeadService.getConversationForLead(lead.id);
    const messages = conv ? LeadService.getMessagesForConversation(conv.id) : [];

    res.status(200).json({
      lead,
      contacts: lead.contacts ?? [],
      socialProfiles: lead.socialProfiles ?? [],
      evidence: lead.evidence ?? [],
      conversation: conv,
      messages
    });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    if (!req.user || !PersistentProspectService.available()) {
      res.status(503).json({ title: "Persistent database unavailable", status: 503 });
      return;
    }
    const lead = await PersistentProspectService.update(req.params.id, req.body, req.user);
    res.status(200).json({ lead });
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    if (!req.user || !PersistentProspectService.available()) {
      res.status(503).json({ title: "Persistent database unavailable", status: 503 });
      return;
    }
    await PersistentProspectService.delete(req.params.id, req.user);
    res.status(204).send();
  }

  public static async exportAll(req: Request, res: Response): Promise<void> {
    if (!req.user || req.user.role !== "FOUNDER") { res.status(403).json({ title: "Founder access required", status: 403 }); return; }
    if (!PersistentProspectService.available()) { res.status(503).json({ title: "Persistent database unavailable", status: 503 }); return; }
    const first = await PersistentProspectService.list(req.user, { page: 1, limit: 100 });
    if (!first) { res.status(503).json({ title: "Unable to export leads", status: 503 }); return; }
    const leads = [...first.leads];
    for (let page = 2; page <= first.totalPages; page++) { const next = await PersistentProspectService.list(req.user, { page, limit: 100 }); if (next) leads.push(...next.leads); }
    res.setHeader("Content-Disposition", `attachment; filename="dfqlabs-leads-${new Date().toISOString().slice(0, 10)}.json"`);
    res.status(200).json({ format: "DFQLABS-OS2-LEADS", version: 1, exportedAt: new Date().toISOString(), total: leads.length, leads });
  }

  public static async importAll(req: Request, res: Response): Promise<void> {
    if (!req.user || req.user.role !== "FOUNDER") { res.status(403).json({ title: "Founder access required", status: 403 }); return; }
    if (!PersistentProspectService.available()) { res.status(503).json({ title: "Persistent database unavailable", status: 503 }); return; }
    const body = req.body as { leads?: unknown; format?: unknown } | unknown[];
    const rows = Array.isArray(body) ? body : body && typeof body === "object" && Array.isArray((body as { leads?: unknown }).leads) ? (body as { leads: unknown[] }).leads : null;
    if (!rows) { res.status(400).json({ title: "Invalid JSON lead file", detail: "Upload an array of leads or a DFQLABS export containing a leads array.", status: 400 }); return; }
    if (rows.length > 2000) { res.status(413).json({ title: "Import too large", detail: "Import up to 2,000 leads per file.", status: 413 }); return; }
    let imported = 0, skipped = 0, failed = 0;
    const errors: string[] = [];
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (!row || typeof row !== "object" || Array.isArray(row)) { failed++; if (errors.length < 50) errors.push(`Row ${index + 1}: expected a lead object.`); continue; }
      const lead = row as Record<string, unknown>;
      const companyName = typeof lead.companyName === "string" ? lead.companyName.trim() : typeof lead.company_name === "string" ? lead.company_name.trim() : "";
      if (!companyName) { failed++; if (errors.length < 50) errors.push(`Row ${index + 1}: companyName is required.`); continue; }
      const contacts = Array.isArray(lead.contacts) ? lead.contacts as Array<Record<string, unknown>> : [];
      const socials = Array.isArray(lead.socialProfiles) ? lead.socialProfiles as Array<Record<string, unknown>> : [];
      const value = (input: unknown): string | undefined => typeof input === "string" && input.trim() ? input.trim() : undefined;
      const contact = (type: string): string | undefined => { const item = contacts.find((entry) => String(entry.contactType || entry.contact_type || "").toUpperCase() === type); return value(item?.normalizedValue) || value(item?.normalized_value) || value(item?.rawValue) || value(item?.raw_value); };
      const social = (platform: string): string | undefined => { const item = socials.find((entry) => String(entry.platform || "").toUpperCase() === platform); return value(item?.handleOrUrl) || value(item?.handle_or_url); };
      const phone = value(lead.phone) || contact("PHONE");
      const whatsapp = value(lead.whatsapp) || contact("WHATSAPP");
      const email = value(lead.email) || contact("EMAIL");
      const instagram = value(lead.instagram) || social("INSTAGRAM");
      const website = value(lead.website) || social("WEBSITE");
      try {
        const match = await PersistentProspectService.duplicateCheck({ company: companyName, phone, whatsapp, email, social: instagram, website }, req.user);
        if (match && match.matchType !== "NO_MATCH") { skipped++; continue; }
        await PersistentProspectService.create({ companyName, contactName: value(lead.contactName) || value(lead.contact_name), titleRole: value(lead.titleRole) || value(lead.title_role), businessType: value(lead.businessType) || value(lead.business_type), location: value(lead.location), description: value(lead.description), phone, whatsapp, email, instagram, website, clientType: value(lead.clientType) || value(lead.client_type), source: value(lead.source), serviceTier: value(lead.serviceTier) || value(lead.service_tier) }, req.user);
        imported++;
      } catch (error) { failed++; if (errors.length < 50) errors.push(`Row ${index + 1} (${companyName}): ${error instanceof Error ? error.message : String(error)}`); }
    }
    res.status(200).json({ imported, skipped, failed, errors });
  }
  public static async generateBriefing(req: Request, res: Response): Promise<void> {
    const lead = LeadService.getLeadById(req.params.id, req.user);
    if (!lead) {
      res.status(404).json({ title: "Lead Not Found", status: 404 });
      return;
    }

    const briefing = await AIEngineService.generateBriefing(lead);

    if (req.user) {
      EventService.logEvent({
        eventType: "BRIEFING_GENERATED",
        leadId: lead.id,
        actorUserId: req.user.id,
        payload: briefing as unknown as Record<string, unknown>
      });
    }

    res.status(200).json({ briefing });
  }
}
