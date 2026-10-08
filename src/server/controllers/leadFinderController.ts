import { Request, Response } from "express";
import { LeadFinderService } from "../services/leadFinderService.js";

export class LeadFinderController {
  static async summary(req: Request, res: Response) { res.json(await LeadFinderService.getTodaySummary(req.user!)); }
  static async settings(req: Request, res: Response) { res.json(await LeadFinderService.getSettings()); }
  static async saveSettings(req: Request, res: Response) { res.json(await LeadFinderService.saveSettings(req.user!, req.body)); }
  static async run(req: Request, res: Response) { res.status(202).json(await LeadFinderService.runDaily(req.user!, Number(req.body?.target || 0) || undefined)); }
  static async history(req: Request, res: Response) { res.json({ runs: await LeadFinderService.getHistory(Number(req.query.limit || 20)) }); }
  static async reset(req: Request, res: Response) { res.json(await LeadFinderService.resetToday(req.user!)); }
}