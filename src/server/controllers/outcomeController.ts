import { Request, Response } from "express";
import { LeadService } from "../services/leadService.js";

export class OutcomeController {
  public static record(req: Request, res: Response): void {
    if (!req.user) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }

    const { leadId, outcomeType, notes } = req.body;
    const outcome = LeadService.recordOutcome(leadId, outcomeType, notes, req.user);
    res.status(201).json({ outcome });
  }
}
