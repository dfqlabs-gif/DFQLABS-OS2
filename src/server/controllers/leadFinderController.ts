import { Request, Response } from "express";
import { LeadFinderService } from "../services/leadFinderService.js";

export class LeadFinderController {
  static async summary(req: Request, res: Response) { res.json(await LeadFinderService.getTodaySummary(req.user!)); }
  static async settings(req: Request, res: Response) { res.json(await LeadFinderService.getSettings()); }
  static async saveSettings(req: Request, res: Response) { res.json(await LeadFinderService.saveSettings(req.user!, req.body)); }

  static async run(req: Request, res: Response) {
    const target = Number(req.body?.target || 0) || undefined;
    const { run, alreadyMet } = await LeadFinderService.startRun(req.user!, target);

    if (alreadyMet) {
      return res.status(200).json({ accepted: true, runId: run.id, status: "COMPLETED", message: "Today's qualified prospect target is already met.", run });
    }

    // The durable RUNNING row exists before the request is acknowledged.
    // Every asynchronous failure is attached to this exact run ID.
    void LeadFinderService.runDaily(req.user!, target, run.id).catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Lead Finder run " + run.id + " failed:", message);
      try {
        const { getSupabaseClient } = await import("../config/supabase.js");
        const db = getSupabaseClient();
        if (!db) throw new Error("Database is not configured while recording run failure.");
        const { data: current, error: readError } = await db.from("lead_finder_runs").select("id,stats").eq("id", run.id).eq("status", "RUNNING").maybeSingle();
        if (readError) throw new Error(readError.message);
        if (current) {
          const { error: writeError } = await db.from("lead_finder_runs").update({
            status: "FAILED", completed_at: new Date().toISOString(),
            stats: { ...(current.stats && typeof current.stats === "object" ? current.stats : {}), failureCode: "BACKGROUND_RUN_UNHANDLED_ERROR", phase: "FAILED", statusMessage: "Lead Finder stopped because an unexpected backend error occurred.", errorMessage: message.slice(0, 1000) }
          }).eq("id", run.id).eq("status", "RUNNING");
          if (writeError) throw new Error(writeError.message);
        }
      } catch (persistError) {
        console.error("Lead Finder failure status could not be persisted:", persistError instanceof Error ? persistError.message : String(persistError));
      }
    });

    return res.status(202).json({ accepted: true, runId: run.id, status: "RUNNING", message: "Lead Finder run started. Durable progress is available in prospecting history." });
  }
  static async cancel(req: Request, res: Response) { res.json(await LeadFinderService.cancelRun(req.user!)); }
  static async history(req: Request, res: Response) { res.json({ runs: await LeadFinderService.getHistory(Number(req.query.limit || 20)) }); }
  static async reset(req: Request, res: Response) { res.json(await LeadFinderService.resetToday(req.user!)); }
}
