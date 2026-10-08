import React, { useEffect, useState } from "react";
import { ApiClient } from "../services/api.js";

export const AdminDashboardPage: React.FC<{ onNavigate?: (path: string) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    return ApiClient.getCeoDashboard().then(setData).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const n = (value: any) => loading ? "—" : String(value ?? 0);
  const pulse = data?.pulse || {};
  const pipeline = data?.pipeline || {};
  const cards = [
    ["Qualified Today", pulse.qualifiedToday, "of 30 target", "/lead-finder"],
    ["Outreach Today", pulse.outreachToday, "messages sent", "/conversations"],
    ["Reply Rate", pulse.replyRate7d, "% · 7 days", "/conversations"],
    ["Positive", pulse.positive7d, "positive conversations", "/conversations"],
    ["Meetings", pulse.meetings7d, "booked · 7 days", "/pipeline"],
    ["Closed Won", pulse.closedWon7d, "wins · 7 days", "/pipeline"]
  ];

  const stages = [
    ["Uncontacted", "UNCONTACTED"], ["Contacted", "CONTACTED"], ["Replied", "REPLIED"],
    ["Audit / Qualified", "QUALIFIED"], ["Meeting", "MEETING_SCHEDULED"],
    ["Proposal", "PROPOSAL_SENT"], ["Won", "CLOSED_WON"]
  ];

  return <div className="mission-control">
    <section className="mission-hero">
      <div>
        <div className="eyebrow">DFQLABS / CEO COMMAND CENTER</div>
        <h1>Know what is moving. Know what needs attention.</h1>
        <p>The founder view is intentionally focused on acquisition, sales execution, pipeline movement and the few things that need your attention.</p>
      </div>
      <div className="mission-actions">
        <button className="btn-primary" onClick={() => onNavigate?.("/lead-finder")}>Find Today’s 30</button>
        <button className="btn-secondary" onClick={() => onNavigate?.("/pipeline")}>Open Pipeline</button>
      </div>
    </section>

    <section className="dashboard-stats">
      {cards.map(([label, value, hint, path]) => (
        <button key={String(label)} className="dashboard-stat glacier" onClick={() => onNavigate?.(String(path))}>
          <span className="stat-label">{label}</span>
          <strong>{label === "Reply Rate" ? n(value) : n(value)}</strong>
          <span className="stat-hint">{hint}</span>
        </button>
      ))}
    </section>

    <section className="card command-health">
      <div>
        <div className="eyebrow">PIPELINE HEALTH</div>
        <h2>Where prospects are sitting right now.</h2>
        <div className="finder-tags">
          {stages.map(([label, key]) => <span key={key}>{label}: <strong>{n(pipeline[key])}</strong></span>)}
        </div>
      </div>
    </section>

    <section className="command-grid">
      <div className="card">
        <div className="eyebrow">SPECIALIST PERFORMANCE · 7 DAYS</div>
        <h2>Who is moving the pipeline?</h2>
        {loading ? <p>Loading performance…</p> : data?.specialists?.length ? (
          <div className="finder-history-list">
            {data.specialists.map((s:any) => <div className="finder-run-row" key={s.id}>
              <span><strong>{s.name}</strong><br/><small>{s.status}</small></span>
              <span>{s.outreach} outreach · {s.replies} replies · {s.positive} positive</span>
              <span>{s.meetings} meetings · {s.won} won</span>
            </div>)}
          </div>
        ) : <p>No outreach specialists configured.</p>}
      </div>

      <div className="card">
        <div className="eyebrow">CEO ATTENTION</div>
        <h2>What needs you?</h2>
        {loading ? <p>Loading attention items…</p> : data?.attention?.length ? (
          <div className="finder-history-list">
            {data.attention.map((item:string, i:number) => <div className="finder-run-row" key={i}><strong>{item}</strong></div>)}
          </div>
        ) : <p>Nothing critical right now. Keep execution moving.</p>}
      </div>
    </section>

    <section className="card command-health">
      <div>
        <div className="eyebrow">LEAD ACQUISITION</div>
        <h2>Verified prospecting quality</h2>
        <p>
          {n(data?.acquisition?.found)} discovered · {n(data?.acquisition?.rejected)} rejected · {n(data?.acquisition?.duplicates)} duplicates · {n(data?.acquisition?.qualified)} qualified.
        </p>
      </div>
      <button className="btn-secondary" onClick={() => onNavigate?.("/lead-finder")}>Open Lead Finder →</button>
    </section>
  </div>;
};
