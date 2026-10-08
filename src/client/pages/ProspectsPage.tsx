import React, { useEffect, useState } from "react";
import { Lead } from "../../shared/types/index.js";
import { Skeleton } from "../components/Skeleton.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { useToast } from "../context/ToastContext.js";
import { ApiClient } from "../services/api.js";

export const ProspectsPage: React.FC<{ onNavigate: (path: string) => void; initialStage?: string }> = ({ onNavigate, initialStage = "" }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState(initialStage);
  const { addToast } = useToast();

  const fetchLeads = (queryStr = search, queryStage = stage) => {
    setLoading(true);
    ApiClient.getProspects({ search: queryStr, stage: queryStage })
      .then((res) => setLeads(res.leads))
      .catch((err) => addToast(err.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLeads("", initialStage); }, [initialStage]);

  useEffect(() => {
    const t = window.setTimeout(() => fetchLeads(search, stage), 250);
    return () => window.clearTimeout(t);
  }, [search, stage]);

  const stageOptions = ["", "UNCONTACTED", "CONTACTED", "REPLIED", "QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL_SENT", "CLOSED_WON", "CLOSED_LOST", "NURTURE"];

  return (
    <div className="directory-page">
      <section className="page-intro">
        <div>
          <div className="eyebrow">LEAD DATABASE</div>
          <h1>Lead Directory</h1>
          <p>Every prospect, owner, stage and contact point in one searchable workspace.</p>
        </div>
        <button className="btn-primary" onClick={() => onNavigate("/prospects/new")}>+ Add Prospect</button>
      </section>

      <section className="directory-toolbar">
        <div className="search-box"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company, contact or location..." /></div>
        <select className="form-select compact-select" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">All stages</option>
          {stageOptions.slice(1).map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
        </select>
        <div className="toolbar-count">{loading ? "Loading…" : `${leads.length} visible`}</div>
      </section>

      <div className="table-container directory-table">
        <table>
          <thead><tr><th>Prospect</th><th>Contact</th><th>Stage</th><th>Owner</th><th>Last activity</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6}><Skeleton height="42px" /></td></tr> :
            leads.length === 0 ? <tr><td colSpan={6} className="empty-state"><strong>No leads yet.</strong><span>Add the first prospect to start the pipeline.</span></td></tr> :
            leads.map((lead) => {
              const phone = lead.contacts?.find((c) => c.isPrimary)?.normalizedValue || "—";
              return <tr key={lead.id} onClick={() => onNavigate(`/prospects/${lead.id}`)} className="clickable-row">
                <td><div className="prospect-cell"><span className="avatar-tile">{(lead.companyName || "?").slice(0,1).toUpperCase()}</span><div><strong>{lead.companyName}</strong><small>{lead.businessType || "Prospect"}</small></div></div></td>
                <td><strong>{lead.contactName || "Unknown contact"}</strong><small>{phone}</small></td>
                <td><StatusBadge status={lead.pipelineStage} /></td>
                <td><span className="owner-chip">{lead.ownerUserId ? "Assigned" : "Unassigned"}</span></td>
                <td><small>{lead.lastContactAt ? new Date(lead.lastContactAt).toLocaleDateString() : "No outreach yet"}</small></td>
                <td><button className="btn-ghost" onClick={(e) => { e.stopPropagation(); onNavigate(`/prospects/${lead.id}`); }}>Open →</button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
