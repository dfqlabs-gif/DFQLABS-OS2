import { Request, Response } from "express";
import { AIEngineService } from "../services/aiEngine.js";
import { DuplicateEngine } from "../services/duplicateEngine.js";
import { EventService } from "../services/eventService.js";
import { LeadService } from "../services/leadService.js";
import { PersistentProspectService } from "../services/persistentProspectService.js";

export class ProspectController {
  public static async duplicateCheck(req: Request, res: Response): Promise<void> {
    const existingLeads = LeadService.getAllLeads(req.user);
    const result = PersistentProspectService.available() ? await PersistentProspectService.duplicateCheck(req.body, req.user!) : DuplicateEngine.checkForDuplicate(req.body, existingLeads);

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


