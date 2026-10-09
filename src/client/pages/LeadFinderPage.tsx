import React from "react";
import { ApiClient } from "../services/api.js";
import { useAuth } from "../context/AuthContext.js";

export const LeadFinderPage: React.FC = () => {
  const { activeRole } = useAuth();
  const [summary, setSummary] = React.useState<any>(null);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState("");
  const [history, setHistory] = React.useState<any[]>([]);
  const [progress, setProgress] = React.useState<any>(null);

  const refresh = React.useCallback(async () => {
    const [s, h] = await Promise.all([
      ApiClient.getLeadFinderSummary(),
      ApiClient.getLeadFinderHistory()
    ]);
    const runs = h.runs || [];
    const active = runs.find((r: any) => r.status === "RUNNING") || null;
    setSummary(s);
    setHistory(runs);
    setRunning(Boolean(active));
    setProgress(active);
    return active;
  }, []);

  React.useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);

  // The scan is server-owned. If the page is unmounted or the user switches tabs,
  // the server run continues; when this page mounts again we reattach to that run.
  React.useEffect(() => {
    if (!running) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const h = await ApiClient.getLeadFinderHistory();
        const runs = h.runs || [];
        const active = runs.find((r: any) => r.status === "RUNNING") || null;
        if (cancelled) return;

        setHistory(runs);
        setProgress(active);

        if (!active) {
          setRunning(false);
          await refresh();
        }
      } catch {
        // Keep the active scan UI alive through transient polling failures.
      }
    };

    poll();
    const timer = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [running, refresh]);

  const run = async () => {
    setError("");

    // Never start a second scan from the UI. The authoritative run state lives
    // in the database, so returning to this page cannot accidentally restart work.
    const active = await refresh();
    if (active) {
      setError("A Lead Finder scan is already running. Reattached to the active scan.");
      return;
    }

    setRunning(true);
    try {
      const result = await ApiClient.runLeadFinder();
      setProgress(result?.lastRun || null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lead Finder failed.");
      await refresh().catch(() => undefined);
    }
  };

  const latestRun = history[0] || null;
  const diagnostics = latestRun?.stats?.rejectionReasons || {};

  const pct = summary
    ? Math.min(100, Math.round((summary.newQualifiedToday / Math.max(1, summary.target)) * 100))
    : 0;

  return <section className="lead-finder-page">
    <div className="lead-finder-hero">
      <div>
        <div className="eyebrow"><span className="finder-live-dot" /> DFQLABS / PROSPECTING INTELLIGENCE</div>
        <h1>Find today’s next 30<span className="hero-period">.</span></h1>
        <p>Discover fresh Nigerian real-estate prospects, qualify them against the DFQLABS standard, and feed only outreach-ready companies into the canonical CRM.</p>
      </div>
      <div className="lead-finder-actions">
        <button className="btn-primary lead-finder-run" onClick={run} disabled={running}>
          {running ? "Scanning the market…" : "Find today’s 30"}
        </button>
        {activeRole === "FOUNDER" && running && <button className="btn-secondary" onClick={async () => {
          if (!window.confirm("Cancel the active Lead Finder run? This keeps any already-qualified leads and only stops the current scan.")) return;
          try { setError(""); await ApiClient.cancelLeadFinder(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Cancellation failed."); }
        }}>Cancel Scan</button>}
        {activeRole === "FOUNDER" && <button className="btn-secondary" onClick={async () => {
          if (!window.confirm("Reset today’s Lead Finder batch? This removes only today’s automated Lead Finder prospects and run history.")) return;
          try {
            setError("");
            await ApiClient.resetLeadFinderToday();
            setProgress(null);
            setRunning(false);
            await refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Reset failed.");
          }
        }} disabled={running}>Reset Today</button>}
      </div>

      {running && progress && (
        <div className="lead-finder-live-progress">
          <div className="live-progress-head">
            <strong>{progress.stats?.statusMessage || "Scanning the market…"}</strong>
            <span>{progress.stats?.created || 0} / {progress.target || 30} qualified</span>
          </div>
          <div className="finder-track">
            <span style={{width: `${Math.min(100, Math.round(((progress.stats?.created || 0) / Math.max(1, progress.target || 30)) * 100))}%`}} />
          </div>
          <div className="finder-meta">
            <span>Queries {progress.stats?.providerQueries || 0} / {progress.stats?.queriesTotal || "…"}</span>
            <span>Found {progress.stats?.found || 0} · Rejected {progress.stats?.rejected || 0} · Duplicates {progress.stats?.duplicate || 0}</span>
          </div>
        </div>
      )}
    </div>

    {error && <div className="lead-finder-error">{error}</div>}

    <div className="lead-finder-progress card">
      <div className="finder-progress-top">
        <div><span className="stat-label">Daily acquisition target</span><strong>{summary?.newQualifiedToday ?? 0}<small> / {summary?.target ?? 30}</small></strong></div>
        <span className="finder-status">{summary?.status === "TARGET_MET" ? "TARGET MET" : "ACTIVE"}</span>
      </div>
      <div className="finder-track"><span style={{width:`${pct}%`}} /></div>
      <div className="finder-meta"><span>{summary?.remaining ?? 30} qualified prospects remaining today</span><span>Minimum score {summary?.minimumScore ?? 70}</span></div>
    </div>

    <div className="finder-grid">
      <div className="card finder-feature">
        <div className="finder-orbit"><span>DFQ</span></div>
        <div><div className="eyebrow">AUTOMATED DISCOVERY</div><h2>Search → qualify → save</h2><p>The engine searches configured markets, enriches public company signals, blocks existing CRM identities, scores fit, and persists qualified prospects. It intentionally over-discovers so 30 means 30 usable prospects—not 30 raw results.</p></div>
      </div>
      <div className="card">
        <div className="stat-label">Configured markets</div>
        <div className="finder-tags">{(summary?.locations || []).map((x:string)=><span key={x}>{x}</span>)}</div>
        <div className="stat-label finder-label-gap">Industries</div>
        <div className="finder-tags">{(summary?.industries || []).slice(0,4).map((x:string)=><span key={x}>{x}</span>)}</div>
      </div>
    </div>

    <div className="card finder-history">
      <div className="finder-history-head">
        <div><div className="eyebrow">PROSPECTING HISTORY</div><h2>Daily acquisition runs</h2></div>
        <span>{summary?.lastRun ? new Date(summary.lastRun.created_at).toLocaleString() : "No runs yet"}</span>
      </div>
      {history.length ? <div className="finder-history-list">{history.map((r:any)=><div className="finder-run-row" key={r.id}><span className="run-date">{r.run_date}</span><strong>{r.qualified_count} qualified</strong><span>{r.found_count} candidates · {r.duplicate_count} duplicates</span><b className={r.status === "COMPLETED" ? "ok" : ""}>{r.status}</b></div>)}</div> : <div className="empty-state"><strong>No prospecting runs yet.</strong><span>Run the engine to build today’s fresh pipeline.</span></div>}
    </div>

    {activeRole === "FOUNDER" && latestRun && latestRun.qualified_count === 0 && latestRun.status !== "RUNNING" && (
      <section className="card finder-diagnostics">
        <div className="eyebrow">RUN DIAGNOSTICS</div>
        <h3>Why this scan saved no leads</h3>
        <p>Search results are candidates, not approved prospects. This breakdown shows where they were filtered. Quality and valid Nigerian phone checks remain in place.</p>
        <div className="diagnostic-grid">
          <div><span>Official website / phone not verified</span><strong>{diagnostics.officialWebsiteNotVerified ?? "Not recorded"}</strong></div>
          <div><span>Weak identity match</span><strong>{diagnostics.weakIdentityMatch ?? "Not recorded"}</strong></div>
          <div><span>Invalid Nigerian phone</span><strong>{diagnostics.invalidNigeriaPhone ?? "Not recorded"}</strong></div>
          <div><span>Below minimum score</span><strong>{diagnostics.belowMinimumScore ?? "Not recorded"}</strong></div>
          <div><span>Duplicate identities</span><strong>{diagnostics.duplicateIdentity ?? "Not recorded"}</strong></div>
          <div><span>Save errors</span><strong>{diagnostics.persistenceError ?? "Not recorded"}</strong></div>
        </div>
      </section>
    )}

    {activeRole === "FOUNDER" && <p className="finder-footnote">Founder controls can configure the daily target, minimum quality score, locations, industries, and provider credentials. Outreach remains human-approved.</p>}
  </section>;
};
