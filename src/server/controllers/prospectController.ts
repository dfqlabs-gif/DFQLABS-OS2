import { Request, Response } from "express";
import { AIEngineService } from "../services/aiEngine.js";
import { DuplicateEngine } from "../services/duplicateEngine.js";
import { EventService } from "../services/eventService.js";
import { LeadService } from "../services/leadService.js";
import { PersistentProspectService } from "../services/persistentProspectService.js";

export class ProspectController {
  public static async duplicateCheck(req: Request, res: Response): Promise<void> {
    const existingLeads = LeadService.getAllLeads(req.user);
    const result = DuplicateEngine.checkForDuplicate(req.body, existingLeads);

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

    const lead = PersistentProspectService.available()\n      ? await PersistentProspectService.create(req.body, req.user)\n      : await LeadService.createLead(req.body, req.user);
    res.status(201).json({ lead });
  }

  public static list(req: Request, res: Response): void {
    const leads = LeadService.getAllLeads(req.user);
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "25", 10);

    const search = ((req.query.search as string) || "").toLowerCase();
    let filtered = leads;
    if (search) {
      filtered = leads.filter(
        (l) =>
          l.companyName.toLowerCase().includes(search) ||
          l.contactName?.toLowerCase().includes(search) ||
          l.location?.toLowerCase().includes(search)
      );
    }

    const stage = req.query.stage as string;
    if (stage) {
      filtered = filtered.filter((l) => l.pipelineStage === stage);
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    res.status(200).json({
      leads: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1
    });
  }

  public static getById(req: Request, res: Response): void {
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
