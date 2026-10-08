import { Request, Response } from "express";
import { LeadService } from "../services/leadService.js";

export class DashboardController {
  public static async missionControl(req: Request, res: Response): Promise<void> {
    const metrics = await LeadService.getMissionControlMetricsAsync(req.user);
    res.status(200).json({ metrics });
  }
  public static async ceo(req: Request, res: Response): Promise<void> {
    if (req.user?.role !== "FOUNDER") {
      res.status(403).json({ message: "Founder access required." });
      return;
    }

    const db = getSupabaseClient();
    if (!db) {
      res.status(200).json({
        pulse: { qualifiedToday: 0, outreachToday: 0, replyRate7d: 0, positive7d: 0, meetings7d: 0, closedWon7d: 0 },
        pipeline: {},
        specialists: [],
        attention: [],
        acquisition: { found: 0, rejected: 0, duplicates: 0, qualified: 0 }
      });
      return;
    }

    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const [
      leadsRes,
      messagesRes,
      outcomesRes,
      usersRes,
      runsRes,
      pendingFollowupsRes
    ] = await Promise.all([
      db.from("leads").select("id,company_name,pipeline_stage,owner_user_id,created_at,next_follow_up_at").eq("status", "ACTIVE"),
      db.from("messages").select("id,sender_user_id,direction,status,sent_at,created_at").gte("created_at", sevenDaysAgo),
      db.from("outcomes").select("lead_id,recorded_by_user_id,outcome_type,created_at").gte("created_at", sevenDaysAgo),
      db.from("users").select("id,full_name,role,is_active").eq("role", "OUTREACH_SPECIALIST"),
      db.from("lead_finder_runs").select("found_count,rejected_count,duplicate_count,qualified_count,status,created_at").gte("created_at", todayStart).order("created_at", { ascending: false }).limit(10),
      db.from("follow_ups").select("id,lead_id,assigned_user_id,due_at,status").eq("status", "PENDING").lt("due_at", now.toISOString())
    ]);

    for (const result of [leadsRes, messagesRes, outcomesRes, usersRes, runsRes, pendingFollowupsRes]) {
      if (result.error) throw new Error(`Unable to load CEO dashboard: ${result.error.message}`);
    }

    const leads = leadsRes.data || [];
    const messages = messagesRes.data || [];
    const outcomes = outcomesRes.data || [];
    const users = usersRes.data || [];
    const runs = runsRes.data || [];

    const sentToday = messages.filter((m: any) => m.direction === "OUTBOUND" && m.status === "SENT" && m.sent_at && m.sent_at >= todayStart);
    const inbound7d = messages.filter((m: any) => m.direction === "INBOUND");
    const outbound7d = messages.filter((m: any) => m.direction === "OUTBOUND" && m.status === "SENT");
    const positiveTypes = new Set(["REPLIED_POSITIVE", "AUDIT_REQUESTED"]);
    const positive = outcomes.filter((o: any) => positiveTypes.has(o.outcome_type));
    const meetings = outcomes.filter((o: any) => o.outcome_type === "MEETING_SCHEDULED");
    const won = outcomes.filter((o: any) => o.outcome_type === "CLOSED_WON");

    const pipeline: Record<string, number> = {};
    for (const lead of leads) pipeline[lead.pipeline_stage] = (pipeline[lead.pipeline_stage] || 0) + 1;

    const specialists = users.map((u: any) => {
      const userOutreach = outbound7d.filter((m: any) => m.sender_user_id === u.id).length;
      const userReplies = inbound7d.filter((m: any) => {
        const lead = leads.find((l: any) => l.id === (messages.find((om: any) => om.id === m.id)?.lead_id));
        return Boolean(lead && lead.owner_user_id === u.id);
      }).length;
      const userPositive = positive.filter((o: any) => o.recorded_by_user_id === u.id).length;
      const userMeetings = meetings.filter((o: any) => o.recorded_by_user_id === u.id).length;
      const userWon = won.filter((o: any) => o.recorded_by_user_id === u.id).length;
      const target = 30 * 7;
      const status = userOutreach >= target ? "EXCELLENT" : userOutreach >= Math.round(target * 0.7) ? "ON TRACK" : "NEEDS ATTENTION";
      return { id: u.id, name: u.full_name, outreach: userOutreach, replies: userReplies, positive: userPositive, meetings: userMeetings, won: userWon, status };
    });

    const latestRun = runs[0];
    const acquisition = {
      found: runs.reduce((n: number, r: any) => n + (r.found_count || 0), 0),
      rejected: runs.reduce((n: number, r: any) => n + (r.rejected_count || 0), 0),
      duplicates: runs.reduce((n: number, r: any) => n + (r.duplicate_count || 0), 0),
      qualified: runs.reduce((n: number, r: any) => n + (r.qualified_count || 0), 0)
    };

    const attention: string[] = [];
    if (acquisition.qualified < 30) attention.push(`Lead acquisition is ${acquisition.qualified}/30 qualified today.`);
    if (outbound7d.length && inbound7d.length / outbound7d.length < 0.1) attention.push("7-day reply rate is below 10%.");
    if ((pendingFollowupsRes.data || []).length > 0) attention.push(`${pendingFollowupsRes.data.length} follow-up(s) are overdue.`);
    if (positive.length > meetings.length) attention.push(`${positive.length - meetings.length} positive conversation(s) have not yet become meetings.`);

    res.status(200).json({
      pulse: {
        qualifiedToday: acquisition.qualified,
        outreachToday: sentToday.length,
        replyRate7d: outbound7d.length ? Math.round((inbound7d.length / outbound7d.length) * 1000) / 10 : 0,
        positive7d: positive.length,
        meetings7d: meetings.length,
        closedWon7d: won.length
      },
      pipeline,
      specialists,
      attention,
      acquisition,
      latestRun: latestRun ? { status: latestRun.status, createdAt: latestRun.created_at } : null
    });
  }

}
