import React, { useEffect, useMemo, useState } from "react";
import { Lead, PipelineStage } from "../../shared/types/index.js";
import { ApiClient } from "../services/api.js";
import { Skeleton } from "../components/Skeleton.js";
import { StatusBadge } from "../components/StatusBadge.js";

const columns: { stage: PipelineStage; label: string; description: string }[] = [
  { stage: "UNCONTACTED", label: "New", description: "Ready for first touch" },
  { stage: "CONTACTED", label: "Contacted", description: "Waiting for a response" },
  { stage: "REPLIED", label: "Replied", description: "Conversation is active" },
  { stage: "QUALIFIED", label: "Qualified", description: "Real opportunity" },
  { stage: "MEETING_SCHEDULED", label: "Meeting", description: "Meeting in motion" },
  { stage: "PROPOSAL_SENT", label: "Proposal", description: "Commercial decision" },
  { stage: "CLOSED_WON", label: "Won", description: "Converted" },
  { stage: "CLOSED_LOST", label: "Lost", description: "Closed out" }
];

export const PipelinePage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ApiClient.getProspects({}).then((r) => setLeads(r.leads)).finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => columns.reduce<Record<string, Lead[]>>((acc, c) => {
    acc[c.stage] = leads.filter((lead) => lead.pipelineStage === c.stage);
    return acc;
  }, {}), [leads]);

  return (
    <div className="pipeline-page">
      <section className="page-intro">
        <div><div className="eyebrow">REVENUE FLOW</div><h1>Pipeline</h1><p>See every active opportunity and move it forward from one command surface.</p></div>
        <button className="btn-primary" onClick={() => onNavigate("/prospects/new")}>+ Add Prospect</button>
      </section>
      <div className="pipeline-summary">
        <span><strong>{loading ? "—" : leads.length}</strong> visible leads</span>
        <span><strong>{loading ? "—" : leads.filter(l => ["QUALIFIED","MEETING_SCHEDULED","PROPOSAL_SENT"].includes(l.pipelineStage)).length}</strong> active opportunities</span>
        <span><strong>{loading ? "—" : leads.filter(l => l.pipelineStage === "CLOSED_WON").length}</strong> won</span>
      </div>
      {loading ? <div className="pipeline-board">{columns.slice(0,5).map(c => <div className="pipeline-column" key={c.stage}><Skeleton height="180px" /></div>)}</div> :
      <div className="pipeline-board">{columns.map(column => {
        const items = grouped[column.stage] || [];
        return <section className="pipeline-column" key={column.stage}>
          <header><div><strong>{column.label}</strong><small>{column.description}</small></div><span>{items.length}</span></header>
          <div className="pipeline-cards">
            {items.length === 0 ? <div className="pipeline-empty">No leads</div> : items.map(lead => <button className="pipeline-card" key={lead.id} onClick={() => onNavigate(`/prospects/${lead.id}`)}>
              <div className="pipeline-card-top"><span className="avatar-tile">{(lead.companyName || "?").slice(0,1).toUpperCase()}</span><StatusBadge status={lead.pipelineStage} /></div>
              <strong>{lead.companyName}</strong>
              <small>{lead.contactName || "Unknown contact"}</small>
              <span className="pipeline-card-arrow">Open →</span>
            </button>)}
          </div>
        </section>;
      })}</div>}
    </div>
  );
};
