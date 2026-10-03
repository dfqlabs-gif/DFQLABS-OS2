import { Request, Response } from "express";
import { LeadService } from "../services/leadService.js";

export class MessageController {
  public static async generateFirstTouch(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }

    try {
      const message = await LeadService.generateFirstTouch(req.body.leadId, req.user);
      res.status(200).json({ message });
    } catch (error) {
      res.status(404).json({
        type: "https://dfqlabs.com/errors/not-found",
        title: "Lead Not Found",
        status: 404,
        detail: error instanceof Error ? error.message : "Lead not found"
      });
    }
  }

  public static updateDraft(req: Request, res: Response): void {
    if (!req.user) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }

    try {
      const message = LeadService.updateMessageDraft(req.params.id, req.body.editedContent, req.user);
      res.status(200).json({ message });
    } catch (error) {
      res.status(404).json({ title: "Message Not Found", status: 404, detail: (error as Error).message });
    }
  }

  public static whatsappOpen(req: Request, res: Response): void {
    if (!req.user) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }

    try {
      const result = LeadService.logWhatsAppOpen(req.params.id, req.user);
      res.status(200).json(result);
    } catch (error) {
      res.status(404).json({ title: "Message Not Found", status: 404, detail: (error as Error).message });
    }
  }

  public static confirmSent(req: Request, res: Response): void {
    if (!req.user) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }

    try {
      const result = LeadService.confirmSent(req.params.id, req.body.finalContent, req.user);
      res.status(200).json(result);
    } catch (error) {
      res.status(404).json({ title: "Message Not Found", status: 404, detail: (error as Error).message });
    }
  }

  public static logInboundReply(req: Request, res: Response): void {
    if (!req.user) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }

    try {
      const message = LeadService.logInboundReply(req.params.id, req.body.content, req.user);
      res.status(200).json({ message });
    } catch (error) {
      res.status(404).json({ title: "Conversation Not Found", status: 404, detail: (error as Error).message });
    }
  }
}
