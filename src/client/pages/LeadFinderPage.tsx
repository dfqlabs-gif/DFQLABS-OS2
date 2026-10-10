import React from "react";
import { ApiClient } from "../services/api.js";
import { useAuth } from "../context/AuthContext.js";

export const LeadFinderPage: React.FC = () => {
  const { activeRole } = useAuth();
  const [summary, setSummary] = React.useState<any>(null);
  const [running, setRunning] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [history, setHistory] = React.useState<any[]>([]);
  const [progress, setProgress] = React.useState<any>(null);
  const [scanAcceptedAt, setScanAcceptedAt] = React.useState<number | null>(null);
  const [trackedRunId, setTrackedRunId] = React.useState<string | null>(null);

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
    setTrackedRunId(active?.id || null);
    return active;
  }, []);

  React.useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);

  React.useEffect(() => {
    if (!running || starting) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const h = await ApiClient.getLeadFinderHistory();
        const runs = h.runs || [];
        const tracked = trackedRunId ? runs.find((r: any) => r.id === trackedRunId) || null : null;
        const active = trackedRunId ? (tracked?.status === "RUNNING" ? tracked : null) : (runs.find((r: any) => r.status === "RUNNING") || null);
        if (cancelled) return;

        setHistory(runs);
        if (tracked) setProgress(tracked);
        else if (active) setProgress(active);

        if (!active) {
          const acceptedAt = scanAcceptedAt;
          const recentRun = tracked || (acceptedAt === null ? null : runs.find((r: any) =>
            r.created_at && new Date(r.created_at).getTime() >= acceptedAt
          ));
          if (recentRun && recentRun.status !== "RUNNING") {
            setRunning(false);
            setScanAcceptedAt(null);
            setTrackedRunId(null);
            await refresh();
            return;
          }
          if (acceptedAt !== null && Date.now() - acceptedAt < 90_000) {
            setProgress({
              status: "RUNNING",
              target: summary?.target || 30,
              stats: { statusMessage: "Scan accepted. Waiting for multi-source execution..." }
            });
            return;
          }
          if (acceptedAt !== null) {
            setRunning(false);
            setScanAcceptedAt(null);
            setTrackedRunId(null);
            setError("The server accepted the scan request, but its run record could not be found after 90 seconds. Check run history and Render logs before retrying.");
            await refresh();
            return;
          }
          setRunning(false);
          setTrackedRunId(null);
          await refresh();
        } else {
          setScanAcceptedAt(null);
          setTrackedRunId(active.id);
        }
      } catch {
        // Keep active scan UI alive through transient polling failures
      }
    };

    poll();
    const timer = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [running, starting, refresh, scanAcceptedAt, summary?.target, trackedRunId]);

  const run = async () => {
    if (running || starting) return;
    setError("");
    setStarting(true);
    try {
      const active = await refresh();
      if (active) {
        setRunning(true);
        setError("A Lead Finder scan is already running. Reattached to active run.");
        return;
      }

      const result = await ApiClient.runLeadFinder();
      if (result?.accepted === false) {
        throw new Error(result?.message || "The server did not accept the Lead Finder run.");
      }
      if (!result?.runId) throw new Error("The server returned no durable run ID. The scan was not started safely.");
      setTrackedRunId(result.runId);
      setScanAcceptedAt(Date.now());
      setProgress(result?.run || { id: result.runId, status: result.status || "RUNNING", target: summary?.target || 30, stats: { statusMessage: "Multi-source scan started..." } });
      if (["COMPLETED", "FAILED", "PARTIAL"].includes(result.status)) {
        setRunning(false);
        setTrackedRunId(null);
        await refresh();
      } else {
        setRunning(true);
      }
    } catch (e) {
      setRunning(false);
      setScanAcceptedAt(null);
      setError(e instanceof Error ? e.message : "Lead Finder could not start.");
      await refresh().catch(() => undefined);
    } finally {
      setStarting(false);
    }
  };

  // Keep the phone awake only while a scan is actively running.
  React.useEffect(() => {
    if (!running) return;
    let lock: { release: () => Promise<void>; addEventListener?: (type: "release", listener: () => void) => void } | null = null;
    let disposed = false;
    const requestWakeLock = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const wakeLockApi = (navigator as Navigator & {
          wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void>; addEventListener?: (type: "release", listener: () => void) => void }> }
        }).wakeLock;
        if (!wakeLockApi || lock) return;
        lock = await wakeLockApi.request("screen");
        if (disposed && lock) {
          await lock.release().catch(() => undefined);
          lock = null;
        }
        if (lock) lock.addEventListener?.("release", () => { lock = null; });
      } catch {
        // Wake Lock is optional and may be unavailable on some browsers.
      }
    };
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void requestWakeLock(); };
    void requestWakeLock();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (lock) void lock.release().catch(() => undefined);
      lock = null;
    };
  }, [running]);

  const latestRun = history[0] || null;
  const diagnostics = latestRun?.stats?.rejectionReasons || {};
  const sourceStats = latestRun?.stats?.sourceStats || {};

  const serperExhausted = Object.values(sourceStats).some((s: any) => s.errorCode === "SERPER_CREDITS_EXHAUSTED");

  const pct = summary
    ? Math.min(100, Math.round((summary.newQualifiedToday / Math.max(1, summary.target)) * 100))
    : 0;

  return (
    <section className="lead-finder-page">
      <div className="lead-finder-hero">
        <div>
          <div className="eyebrow"><span className="finder-live-dot" /> DFQLABS / PROSPECTING INTELLIGENCE</div>
          <h1>Find today’s next 30<span className="hero-period">.</span></h1>
          <p>Discover fresh Nigerian real-estate prospects across Serper, OpenStreetMap, and Business Directories, qualify them, and save outreach-ready candidates to the CRM.</p>
        </div>
        <div className="lead-finder-actions">
          <button className="btn-primary lead-finder-run" onClick={run} disabled={running || starting}>
            {starting ? "Starting scan…" : running ? "Scanning markets…" : "Find today’s 30"}
          </button>
          {activeRole === "FOUNDER" && running && (
            <button className="btn-secondary" onClick={async () => {
              if (!window.confirm("Cancel the active Lead Finder run?")) return;
              try { setError(""); await ApiClient.cancelLeadFinder(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Cancellation failed."); }
            }}>Cancel Scan</button>
          )}
          {activeRole === "FOUNDER" && (
            <button className="btn-secondary" onClick={async () => {
              if (!window.confirm("Clear today’s Lead Finder run history? Existing CRM prospects will be preserved and will continue to count toward today’s target. This does not reset target progress.")) return;
              try {
                setError("");
                await ApiClient.resetLeadFinderToday();
                setProgress(null);
                setRunning(false);
                await refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Reset failed.");
              }
            }} disabled={running}>Clear Run History</button>
          )}
        </div>

        {running && progress && (
          <div className="lead-finder-live-progress">
            <div className="live-progress-head">
              <strong>{progress.stats?.statusMessage || "Scanning multi-source providers..."}</strong>
              <span>{progress.stats?.created || 0} / {progress.target || 30} qualified</span>
            </div>
            <div className="finder-track">
              <span style={{width: `${Math.min(100, Math.round(((progress.stats?.created || 0) / Math.max(1, progress.target || 30)) * 100))}%`}} />
            </div>
            <div className="finder-meta">
              <span>Candidates: {progress.stats?.found || 0} · Rejected: {progress.stats?.rejected || 0} · Duplicates: {progress.stats?.duplicate || 0}</span>
            </div>
          </div>
        )}
      </div>

      {serperExhausted && (
        <div className="lead-finder-error" style={{ background: "rgba(245, 158, 11, 0.15)", borderColor: "#F59E0B", color: "#F59E0B" }}>
          ⚠️ Serper search provider credits are exhausted. The engine is continuing discovery using OpenStreetMap and public directories.
        </div>
      )}

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
          <div>
            <div className="eyebrow">MULTI-SOURCE DISCOVERY</div>
            <h2>Serper + OpenStreetMap + Public Directories</h2>
            <p>Independent discovery sources query targeted locations, validate Nigerian mobile phone formats (+234), verify company identities, filter duplicate records, and promote verified prospects into the CRM.</p>
          </div>
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
        {history.length ? (
          <div className="finder-history-list">
            {history.map((r:any)=>(
              <div className="finder-run-row" key={r.id}>
                <span className="run-date">{r.run_date}</span>
                <strong>{r.qualified_count} qualified</strong>
                <span>{r.found_count} candidates · {r.duplicate_count} duplicates</span>
                <b className={r.status === "COMPLETED" ? "ok" : ""}>{r.status}</b>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><strong>No prospecting runs yet.</strong><span>Run the engine to build today’s pipeline.</span></div>
        )}
      </div>

      {latestRun?.status === "FAILED" && (
        <div className="lead-finder-error">
          <strong>{latestRun.stats?.failureCode === "ALL_PROVIDERS_UNAVAILABLE" ? "No discovery provider was available." : "Lead Finder did not discover any candidates."}</strong>
          <div>{latestRun.stats?.statusMessage || "Review the provider diagnostics and server logs before retrying."}</div>
        </div>
      )}
      {latestRun?.status === "PARTIAL" && (
        <div className="finder-diagnostics-note">
          <strong>Partial scan: the qualified-prospect target was not reached.</strong>
          <span>{latestRun.stats?.statusMessage || "Review the source and qualification diagnostics below."}</span>
        </div>
      )}

      {activeRole === "FOUNDER" && latestRun && latestRun.status !== "RUNNING" && (
        <section className="card finder-diagnostics">
          <div className="eyebrow">SOURCE & QUALIFICATION DIAGNOSTICS</div>
          <h3>Multi-Source Yield Report</h3>
          <div className="diagnostic-grid">
            <div><span>Candidates reviewed</span><strong>{latestRun.found_count ?? 0}</strong></div>
            <div><span>Saved as qualified</span><strong>{latestRun.qualified_count ?? 0}</strong></div>
            <div><span>Generic names rejected</span><strong>{diagnostics.genericCompanyName ?? 0}</strong></div>
            <div><span>Invalid Nigerian phone</span><strong>{diagnostics.invalidNigeriaPhone ?? 0}</strong></div>
            <div><span>Below min score</span><strong>{diagnostics.belowMinimumScore ?? 0}</strong></div>
            <div><span>Duplicate identities</span><strong>{diagnostics.duplicateIdentity ?? 0}</strong></div>
          </div>
          {Object.keys(sourceStats).length > 0 && (
            <div className="finder-history-list source-yield-list" style={{ marginTop: "1rem" }}>
              <strong>Provider Status & Execution</strong>
              {Object.entries(sourceStats).map(([src, res]: [string, any]) => (
                <div className="finder-run-row" key={src}>
                  <span className="run-date">{src}</span>
                  <span>{res.succeeded ? "✅ Succeeded" : `❌ ${res.errorCode || "Failed"}`}</span>
                  <strong>{res.candidates?.length || 0} candidates</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
};
