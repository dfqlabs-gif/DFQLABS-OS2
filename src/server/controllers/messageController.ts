import { Request, Response } from "express";
import { LeadService } from "../services/leadService.js";
import { PersistentProspectService } from "../services/persistentProspectService.js";

export class MessageController {
  public static async generateFirstTouch(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }

    try {
      const message = PersistentProspectService.available() ? await PersistentProspectService.generateFirstTouch(req.body.leadId, req.user) : await LeadService.generateFirstTouch(req.body.leadId, req.user);
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

  public static async updateDraft(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }

    try {
      const message = PersistentProspectService.available() ? await PersistentProspectService.updateMessageDraft(req.params.id, req.body.editedContent, req.user) : LeadService.updateMessageDraft(req.params.id, req.body.editedContent, req.user);
      res.status(200).json({ message });
    } catch (error) {
      res.status(404).json({ title: "Message Not Found", status: 404, detail: (error as Error).message });
    }
  }

  public static async whatsappOpen(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }

    try {
      const result = PersistentProspectService.available() ? await PersistentProspectService.openWhatsApp(req.params.id, req.user) : LeadService.logWhatsAppOpen(req.params.id, req.user);
      res.status(200).json(result);
    } catch (error) {
      res.status(404).json({ title: "Message Not Found", status: 404, detail: (error as Error).message });
    }
  }

  public static async confirmSent(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }

    try {
      const result = PersistentProspectService.available() ? await PersistentProspectService.confirmSent(req.params.id, req.body.finalContent, req.user) : LeadService.confirmSent(req.params.id, req.body.finalContent, req.user);
      res.status(200).json(result);
    } catch (error) {
      res.status(404).json({ title: "Message Not Found", status: 404, detail: (error as Error).message });
    }
  }

  public static async generateFollowUp(req: Request, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ title: "Unauthorized", status: 401 }); return; }
    try {
      const message = PersistentProspectService.available() ? await PersistentProspectService.generateFollowUp(req.body.leadId, req.user) : await LeadService.generateFirstTouch(req.body.leadId, req.user);
      res.status(200).json({ message });
    } catch (error) { res.status(404).json({ title: "Unable to generate follow-up", status: 404, detail: error instanceof Error ? error.message : "Lead not found" }); }
  }

  public static async logManualOutbound(req:Request,res:Response):Promise<void>{if(!req.user){res.status(401).json({title:"Unauthorized",status:401});return;}try{const message=await PersistentProspectService.logManualOutbound(req.params.leadId,req.body.content,req.body.sentAt,req.user);res.status(201).json({message});}catch(e){res.status(400).json({title:"Unable to log outbound",status:400,detail:e instanceof Error?e.message:"Unable to log"});}}
  public static async reportContactIssue(req:Request,res:Response):Promise<void>{if(!req.user){res.status(401).json({title:"Unauthorized",status:401});return;}try{const issue=await PersistentProspectService.reportContactIssue(req.params.leadId,req.body.issueType,req.body.notes,req.user);res.status(201).json({issue});}catch(e){res.status(400).json({title:"Unable to report issue",status:400,detail:e instanceof Error?e.message:"Unable to report"});}}
  public static async listContactIssues(req:Request,res:Response):Promise<void>{if(!req.user){res.status(401).json({title:"Unauthorized",status:401});return;}try{res.status(200).json({issues:await PersistentProspectService.listContactIssues(req.user)});}catch(e){res.status(500).json({title:"Unable to load issues",status:500,detail:e instanceof Error?e.message:"Unable to load"});}}
  public static async resolveContactIssue(req:Request,res:Response):Promise<void>{if(!req.user){res.status(401).json({title:"Unauthorized",status:401});return;}try{const issue=await PersistentProspectService.resolveContactIssue(req.params.id,req.body.resolutionNotes,req.user);res.status(200).json({issue});}catch(e){res.status(400).json({title:"Unable to resolve issue",status:400,detail:e instanceof Error?e.message:"Unable to resolve"});}}
  public static async logInboundReply(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ title: "Unauthorized", status: 401 });
      return;
    }

    try {
      const message = PersistentProspectService.available() ? await PersistentProspectService.logInboundReply(req.params.id, req.body.content, req.body.sentAt, req.user) : LeadService.logInboundReply(req.params.id, req.body.content, req.user);
      res.status(200).json({ message });
    } catch (error) {
      res.status(404).json({ title: "Conversation Not Found", status: 404, detail: (error as Error).message });
    }
  }
}
