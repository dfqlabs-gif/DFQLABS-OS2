import React, { useEffect, useState } from "react";
import { FocusItem, TodayFocusMetrics } from "../../shared/types/index.js";
import { Skeleton } from "../components/Skeleton.js";
import { StatCard } from "../components/StatCard.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { useToast } from "../context/ToastContext.js";
import { ApiClient } from "../services/api.js";

const emptyMetrics: TodayFocusMetrics = { target: 30, sentToday: 0, firstTouchesToday: 0, followUpsSentToday: 0, queuedFirstTouches: 0, dueFollowUps: 0, unrepliedInbound: 0, remainingFirstTouches: 30 };
const kindLabel: Record<FocusItem["type"], string> = { UNREPLIED_INBOUND: "REPLY NEEDED", OVERDUE_FOLLOW_UP: "FOLLOW-UP DUE", UNCONTACTED_PROSPECT: "FIRST TOUCH" };

export const FocusPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [items, setItems] = useState<FocusItem[]>([]);
  const [metrics, setMetrics] = useState<TodayFocusMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();
  const load = () => {
    setLoading(true);
    ApiClient.getTodayFocus().then((res) => { setItems(res.focusItems); setMetrics(res.metrics || emptyMetrics); })
      .catch((err) => addToast(err.message, "error")).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const progress = Math.min(100, Math.round((metrics.firstTouchesToday / Math.max(1, metrics.target)) * 100));
  const ordered = [...items.filter((item) => item.type === "UNREPLIED_INBOUND"), ...items.filter((item) => item.type === "OVERDUE_FOLLOW_UP"), ...items.filter((item) => item.type === "UNCONTACTED_PROSPECT")];

  return <div className="focus-workspace">
    <section className="page-intro">
      <div><div className="eyebrow">OUTREACH SPECIALIST WORKSPACE</div><h1>Good morning. Here’s your work for today.</h1><p>Work from leads already in DFQLABS OS. The system queues contactable prospects for you; Lead Finder replenishes the pool rather than being a daily prerequisite.</p></div>
      <button className="btn-secondary" onClick={load} disabled={loading}>↻ Refresh focus</button>
    </section>
    <div className="grid-stats">
      <StatCard label="New Outreach Progress" value={loading ? "…" : `${metrics.firstTouchesToday}/${metrics.target}`} description={`${metrics.remainingFirstTouches} first touches remaining today`} accentColor="#00d4ff" />
      <StatCard label="Follow-ups Due" value={loading ? "…" : metrics.dueFollowUps} description={`${metrics.followUpsSentToday} follow-ups sent today`} accentColor="#f59e0b" />
      <StatCard label="Replies To Handle" value={loading ? "…" : metrics.unrepliedInbound} description="Respond before starting more cold outreach" accentColor="#10b981" />
      <StatCard label="Ready To Contact" value={loading ? "…" : metrics.queuedFirstTouches} description="Contactable leads queued from your existing database" />
    </div>
    <section className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 10 }}>
        <div><h2 style={{ fontSize: 16, margin: 0 }}>Daily first-touch target</h2><p style={{ color: "var(--text-muted)", fontSize: 12, margin: "5px 0 0" }}>30 new first-touch messages per working day. Due follow-ups and inbound replies are additional responsibilities.</p></div>
        <strong style={{ color: "var(--accent-glacier)", whiteSpace: "nowrap" }}>{progress}%</strong>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "var(--bg-primary)", overflow: "hidden", border: "1px solid var(--border-color)" }}><div style={{ width: `${progress}%`, height: "100%", background: "var(--accent-glacier)", transition: "width 180ms ease" }} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}><span>{metrics.firstTouchesToday} first touches confirmed sent</span><span>{metrics.queuedFirstTouches} contactable leads ready</span></div>
    </section>
    <section className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div><h2 style={{ fontSize: 16, margin: 0 }}>Today’s action queue</h2><p style={{ color: "var(--text-muted)", fontSize: 12, margin: "5px 0 0" }}>Priority order: prospect replies, due follow-ups, then new outreach.</p></div>
        <button className="btn-secondary" onClick={() => onNavigate("/prospects")}>Open My Leads</button>
      </div>
      {loading ? <div style={{ display: "flex", flexDirection: "column", gap: 12 }}><Skeleton height="80px" /><Skeleton height="80px" /></div> :
        ordered.length === 0 ? <div className="empty-state"><strong>No pending actions.</strong><span>If your ready-to-contact queue is empty, ask the Founder to replenish the lead pool or run Lead Finder.</span></div> :
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{ordered.map((item) => <div key={item.id} style={{ border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: 16, background: "var(--bg-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div style={{ minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}><strong style={{ fontSize: 15 }}>{item.lead.companyName}</strong><StatusBadge status={item.lead.pipelineStage} /><span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".06em", color: item.type === "UNREPLIED_INBOUND" ? "#10b981" : item.type === "OVERDUE_FOLLOW_UP" ? "#f59e0b" : "var(--accent-glacier)" }}>{kindLabel[item.type]}</span></div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>{item.priorityReason}</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.recommendedAction}</div></div>
          <button className="btn-primary" onClick={() => onNavigate(`/prospects/${item.lead.id}`)}>Open dossier →</button>
        </div>)}</div>}
    </section>
  </div>;
};
