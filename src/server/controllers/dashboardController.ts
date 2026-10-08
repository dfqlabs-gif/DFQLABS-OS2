import { Request, Response } from "express";
import { LeadService } from "../services/leadService.js";

export class DashboardController {
  public static async missionControl(req: Request, res: Response): Promise<void> {
    const metrics = await LeadService.getMissionControlMetricsAsync(req.user);
    res.status(200).json({ metrics });
  }
}
