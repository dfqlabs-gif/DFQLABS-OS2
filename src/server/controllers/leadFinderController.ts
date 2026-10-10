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
    void LeadFinderService.runDaily(req.user!, target).catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Lead Finder background run failed:", message);
      // The HTTP request has already returned 202, so persist unexpected job
      // failures instead of leaving the UI with a RUNNING row until stale recovery.
      try {
        const { getSupabaseClient } = await import("../config/supabase.js");
        const db = getSupabaseClient();
        if (!db) return;
        const today = new Date().toISOString().slice(0, 10);
        const { data: activeRun } = await db
          .from("lead_finder_runs")
          .select("id,stats")
          .eq("run_date", today)
          .eq("requested_by_user_id", req.user!.id)
          .eq("status", "RUNNING")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (activeRun) {
          await db.from("lead_finder_runs").update({
            status: "FAILED",
            completed_at: new Date().toISOString(),
            stats: {
              ...(activeRun.stats && typeof activeRun.stats === "object" ? activeRun.stats : {}),
              failureCode: "BACKGROUND_RUN_UNHANDLED_ERROR",
              statusMessage: "Lead Finder stopped because an unexpected backend error occurred.",
              errorMessage: message.slice(0, 1000)
            }
          }).eq("id", activeRun.id).eq("status", "RUNNING");
        }
      } catch (persistError) {
        console.error("Lead Finder failure status could not be persisted:", persistError instanceof Error ? persistError.message : String(persistError));
      }
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
