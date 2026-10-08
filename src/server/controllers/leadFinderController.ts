import { Request, Response } from "express";
import { LeadFinderService } from "../services/leadFinderService.js";

export class LeadFinderController {
  static async summary(req: Request, res: Response) { res.json(await LeadFinderService.getTodaySummary(req.user!)); }
  static async settings(req: Request, res: Response) { res.json(await LeadFinderService.getSettings()); }
  static async saveSettings(req: Request, res: Response) { res.json(await LeadFinderService.saveSettings(req.user!, req.body)); }

  static async run(req: Request, res: Response) {
    const target = Number(req.body?.target || 0) || undefined;

    // Lead Finder is a long-running server job. Never hold the HTTP request open
    // while searching and verifying hundreds of candidates; proxies/load balancers
    // can time out and return an HTML error page even though the job is still running.
    void LeadFinderService.runDaily(req.user!, target).catch((error) => {
      console.error("Lead Finder background run failed:", error);
    });

    res.status(202).json({
      accepted: true,
      message: "Lead Finder run started. Progress is persisted in prospecting history.",
      status: "RUNNING"
    });
  }

  static async cancel(req: Request, res: Response) { res.json(await LeadFinderService.cancelRun(req.user!)); }
  static async history(req: Request, res: Response) { res.json({ runs: await LeadFinderService.getHistory(Number(req.query.limit || 20)) }); }
  static async reset(req: Request, res: Response) { res.json(await LeadFinderService.resetToday(req.user!)); }
}
