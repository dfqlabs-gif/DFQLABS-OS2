import React from "react";
import { ApiClient } from "../services/api.js";
import { useAuth } from "../context/AuthContext.js";

export const LeadFinderPage: React.FC = () => {
  const { activeRole } = useAuth();
  const [summary, setSummary] = React.useState<any>(null);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState("");
  const [history, setHistory] = React.useState<any[]>([]);
  const refresh = React.useCallback(async () => {
    const [s,h] = await Promise.all([ApiClient.getLeadFinderSummary(), ApiClient.getLeadFinderHistory()]);
    setSummary(s); setHistory(h.runs || []);
  }, []);
  React.useEffect(() => { refresh().catch((e) => setError(e.message)); }, [refresh]);
  const run = async () => {
    setRunning(true); setError("");
    try { await ApiClient.runLeadFinder(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Lead Finder failed."); }
    finally { setRunning(false); }
  };
  const pct = summary ? Math.min(100, Math.round((summary.newQualifiedToday / Math.max(1, summary.target)) * 100)) : 0;
  return <section className="lead-finder-page">
    <div className="lead-finder-hero">
      <div><div className="eyebrow">DFQLABS / PROSPECTING INTELLIGENCE</div><h1>Find today’s next 30.</h1><p>Discover fresh Nigerian real-estate prospects, qualify them against the DFQLABS standard, and feed only outreach-ready companies into the canonical CRM.</p></div>
      <button className="btn-primary lead-finder-run" onClick={run} disabled={running}>{running ? "Scanning the market…" : "✦ Find Today’s 30"}</button>
    </div>
    {error && <div className="lead-finder-error">{error}</div>}
    <div className="lead-finder-progress card">
      <div className="finder-progress-top"><div><span className="stat-label">Daily acquisition target</span><strong>{summary?.newQualifiedToday ?? 0}<small> / {summary?.target ?? 30}</small></strong></div><span className="finder-status">{summary?.status === "TARGET_MET" ? "TARGET MET" : "ACTIVE"}</span></div>
      <div className="finder-track"><span style={{width:`${pct}%`}} /></div>
      <div className="finder-meta"><span>{summary?.remaining ?? 30} qualified prospects remaining today</span><span>Minimum score {summary?.minimumScore ?? 70}</span></div>
    </div>
    <div className="finder-grid">
      <div className="card finder-feature"><div className="finder-orbit"><span>DFQ</span></div><div><div className="eyebrow">AUTOMATED DISCOVERY</div><h2>Search → qualify → save</h2><p>The engine searches configured markets, enriches public company signals, blocks existing CRM identities, scores fit, and persists qualified prospects. It intentionally over-discovers so 30 means 30 usable prospects—not 30 raw results.</p></div></div>
      <div className="card"><div className="stat-label">Configured markets</div><div className="finder-tags">{(summary?.locations || []).map((x:string)=><span key={x}>{x}</span>)}</div><div className="stat-label finder-label-gap">Industries</div><div className="finder-tags">{(summary?.industries || []).slice(0,4).map((x:string)=><span key={x}>{x}</span>)}</div></div>
    </div>
    <div className="card finder-history"><div className="finder-history-head"><div><div className="eyebrow">PROSPECTING HISTORY</div><h2>Daily acquisition runs</h2></div><span>{summary?.lastRun ? new Date(summary.lastRun.created_at).toLocaleString() : "No runs yet"}</span></div>
      {history.length ? <div className="finder-history-list">{history.map((r:any)=><div className="finder-run-row" key={r.id}><span>{r.run_date}</span><strong>{r.qualified_count} qualified</strong><span>{r.found_count} found · {r.duplicate_count} duplicates</span><b className={r.status === "COMPLETED" ? "ok" : ""}>{r.status}</b></div>)}</div> : <div className="empty-state"><strong>No prospecting runs yet.</strong><span>Run the engine to build today’s fresh pipeline.</span></div>}
    </div>
    {activeRole === "FOUNDER" && <p className="finder-footnote">Founder controls can configure the daily target, minimum quality score, locations, industries, and provider credentials. Outreach remains human-approved.</p>}
  </section>;
};