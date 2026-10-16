import { Request, Response } from "express";
import { LeadService } from "../services/leadService.js";
import { PersistentProspectService } from "../services/persistentProspectService.js";

export class FocusController {
  public static getToday(req: Request, res: Response): void {
    if (!req.user) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }

    if (PersistentProspectService.available()) {
      const result = await PersistentProspectService.getTodayFocus(req.user);
      res.status(200).json(result);
      return;
    }
    const focusItems = LeadService.getTodayFocus(req.user);
    res.status(200).json({ focusItems, metrics: { target: 30, sentToday: 0, firstTouchesToday: 0, followUpsSentToday: 0, queuedFirstTouches: focusItems.filter((item) => item.type === "UNCONTACTED_PROSPECT").length, dueFollowUps: focusItems.filter((item) => item.type === "OVERDUE_FOLLOW_UP").length, unrepliedInbound: focusItems.filter((item) => item.type === "UNREPLIED_INBOUND").length, remainingFirstTouches: 30 } });
  }
}
