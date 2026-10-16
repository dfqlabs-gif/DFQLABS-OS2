import React, { useEffect, useState } from "react";
import { Lead } from "../../shared/types/index.js";
import { Skeleton } from "../components/Skeleton.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { useToast } from "../context/ToastContext.js";
import { useAuth } from "../context/AuthContext.js";
import { ApiClient } from "../services/api.js";

const PAGE_SIZE = 25;

export const ProspectsPage: React.FC<{ onNavigate: (path: string) => void; initialStage?: string }> = ({ onNavigate, initialStage = "" }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState(initialStage);
  const { addToast } = useToast();
  const { activeRole } = useAuth();

  useEffect(() => {
    let active = true;
    setLoading(true);
    ApiClient.getProspects({ search, stage, limit: PAGE_SIZE, page })
      .then((res) => { if (active) { setLeads((current) => page === 1 ? res.leads : [...current, ...res.leads]); setTotal(res.total); } })
      .catch((err) => { if (active) addToast(err.message, "error"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, stage, page]);

  useEffect(() => { setStage(initialStage); setPage(1); }, [initialStage]);

  const exportJson = async () => {
    setExporting(true);
    try {
      const data = await ApiClient.exportProspects();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `dfqlabs-leads-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      addToast(`Exported ${data.leads.length} leads to JSON.`, "success");
    } catch (err) { addToast(err instanceof Error ? err.message : "Lead export failed.", "error"); }
    finally { setExporting(false); }
  };

  const importJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const payload: unknown = JSON.parse(await file.text());
      const result = await ApiClient.importProspects(payload);
      addToast(`Import complete: ${result.imported} imported, ${result.skipped} duplicates skipped, ${result.failed} failed.`, result.failed ? "error" : "success");
      if (result.errors.length) console.warn("Lead import row errors:", result.errors);
      setPage(1);
      const refreshed = await ApiClient.getProspects({ search, stage, limit: PAGE_SIZE, page: 1 });
      setLeads(refreshed.leads); setTotal(refreshed.total);
    } catch (err) { addToast(err instanceof Error ? err.message : "Could not import this JSON file.", "error"); }
    finally { setImporting(false); event.target.value = ""; }
  };

  const stageOptions = ["", "UNCONTACTED", "CONTACTED", "REPLIED", "QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL_SENT", "CLOSED_WON", "CLOSED_LOST", "NURTURE"];
  const hasMore = leads.length < total;

  return (
    <div className="directory-page">
      <section className="page-intro">
        <div><div className="eyebrow">{activeRole === "FOUNDER" ? "LEAD DATABASE" : "YOUR OUTREACH WORKSPACE"}</div><h1>{activeRole === "FOUNDER" ? "Lead Directory" : "My Leads"}</h1><p>{activeRole === "FOUNDER" ? "Every prospect, owner, stage and contact point in one searchable workspace." : "Your assigned contactable prospects, outreach history and next actions. Today’s Focus automatically queues up to 30 new prospects from the shared founder-owned pool."}</p></div>
        <div className="directory-header-actions">
          {activeRole === "FOUNDER" && <>
            <button className="btn-secondary" onClick={exportJson} disabled={exporting || loading}>{exporting ? "Exporting…" : "Export JSON"}</button>
            <label className={"btn-secondary import-json-label" + (importing ? " is-disabled" : "")}>{importing ? "Importing…" : "Import JSON"}<input type="file" accept=".json,application/json" disabled={importing} onChange={importJson} /></label>
          </>}
          <button className="btn-primary" onClick={() => onNavigate("/prospects/new")}>+ Add Prospect</button>
        </div>
      </section>
      <section className="directory-toolbar">
        <div className="search-box"><span>⌕</span><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); setLeads([]); }} placeholder="Search company, contact or location..." /></div>
        <select className="form-select compact-select" value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); setLeads([]); }}>
          <option value="">All stages</option>{stageOptions.slice(1).map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
        </select>
        <div className="toolbar-count">{loading ? "Loading…" : `${total} ${activeRole === "FOUNDER" ? "total prospects" : "assigned leads"} · showing ${leads.length}`}</div>
      </section>
      <div className="table-container directory-table">
        <table>
          <thead><tr><th>#</th><th>Prospect</th><th>Contact</th><th>Stage</th><th>Owner</th><th>Date added</th><th>Last activity</th><th></th></tr></thead>
          <tbody>
            {loading && leads.length === 0 ? <tr><td colSpan={8}><Skeleton height="42px" /></td></tr> :
              leads.length === 0 ? <tr><td colSpan={8} className="empty-state"><strong>No leads yet.</strong><span>Add the first prospect to start the pipeline.</span></td></tr> :
              leads.map((lead, index) => {
                const phone = lead.contacts?.find((contact) => contact.isPrimary)?.normalizedValue || "—";
                const added = lead.createdAt ? new Date(lead.createdAt) : null;
                return <tr key={lead.id} onClick={() => onNavigate(`/prospects/${lead.id}`)} className="clickable-row">
                  <td>{index + 1}</td>
                  <td><div className="prospect-cell"><span className="avatar-tile">{(lead.companyName || "?").slice(0,1).toUpperCase()}</span><div><strong>{lead.companyName}</strong><small>{lead.businessType || "Prospect"}</small></div></div></td>
                  <td><strong>{lead.contactName || "Unknown contact"}</strong><small>{phone}</small></td>
                  <td><StatusBadge status={lead.pipelineStage} /></td>
                  <td><span className="owner-chip">{lead.ownerUserId ? "Assigned" : "Unassigned"}</span></td>
                  <td><small>{added && !Number.isNaN(added.getTime()) ? added.toLocaleDateString() + " " + added.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Unknown"}</small></td>
                  <td><small>{lead.lastContactAt ? new Date(lead.lastContactAt).toLocaleDateString() : "No outreach yet"}</small></td>
                  <td><button className="btn-ghost" onClick={(e) => { e.stopPropagation(); onNavigate(`/prospects/${lead.id}`); }}>Open →</button></td>
                </tr>;
              })}
          </tbody>
        </table>
      </div>
      <div className="directory-pagination">
        <span>{loading && leads.length > 0 ? "Loading more leads…" : `Showing ${leads.length} of ${total} prospects`}</span>
        {hasMore && <button className="btn-secondary" onClick={() => setPage((current) => current + 1)} disabled={loading}>Load more prospects</button>}
      </div>
    </div>
  );
};
