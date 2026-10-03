import { Request, Response } from "express";
import { LeadService } from "../services/leadService.js";

export class DashboardController {
  public static missionControl(_req: Request, res: Response): void {
    const metrics = LeadService.getMissionControlMetrics();
    res.status(200).json({ metrics });
  }
}
