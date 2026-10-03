import { Request, Response } from "express";
import { LeadService } from "../services/leadService.js";

export class FocusController {
  public static getToday(req: Request, res: Response): void {
    if (!req.user) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }

    const focusItems = LeadService.getTodayFocus(req.user);
    res.status(200).json({ focusItems });
  }
}
