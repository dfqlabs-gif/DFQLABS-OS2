import React, { useEffect, useState } from "react";
import { MissionControlMetrics } from "../../shared/types/index.js";
import { Skeleton } from "../components/Skeleton.js";
import { ApiClient } from "../services/api.js";

export const AdminDashboardPage: React.FC<{ onNavigate?: (path: string) => void }> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<MissionControlMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ApiClient.getMissionControl()
      .then((res) => setMetrics(res.metrics))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const value = (n?: number) => loading ? "—" : String(n ?? 0);
  const cards = [
    { label: "Total Leads", value: value(metrics?.totalLeads), hint: "Every prospect in OS2", path: "/prospects", tone: "glacier" },
    { label: "Uncontacted", value: value(metrics?.uncontactedLeads), hint: "Ready for first touch", path: "/prospects", tone: "amber" },
    { label: "Contacted", value: value(metrics?.contactedLeads), hint: "Outbound already sent", path: "/prospects", tone: "blue" },
    { label: "Inbound Replies", value: value(metrics?.repliedLeads), hint: "Conversations needing attention", path: "/conversations", tone: "green" }
  ];

  return (
    <div className="mission-control">
      <section className="mission-hero">
        <div>
          <div className="eyebrow">FOUNDER COMMAND</div>
          <h1>See the business. Move the pipeline.</h1>
          <p>Your command center for leads, conversations, team activity and revenue opportunities.</p>
        </div>
        <div className="mission-actions">
          <button className="btn-primary" onClick={() => onNavigate?.("/prospects/new")}>+ Add Prospect</button>
          <button className="btn-secondary" onClick={() => onNavigate?.("/pipeline")}>Open Pipeline</button>
        </div>
      </section>

      <section className="dashboard-stats">
        {cards.map((card) => (
          <button key={card.label} className={`dashboard-stat ${card.tone}`} onClick={() => onNavigate?.(card.path)}>
            <span className="stat-label">{card.label}</span>
            <strong>{card.value}</strong>
            <span className="stat-hint">{card.hint}</span>
            <span className="stat-arrow">→</span>
          </button>
        ))}
      </section>

      <section className="command-grid">
        <button className="command-card command-card-primary" onClick={() => onNavigate?.("/prospects")}>
          <div className="command-card-icon">▤</div>
          <div>
            <div className="eyebrow">DATABASE</div>
            <h2>Lead Directory</h2>
            <p>Search, filter and open every prospect in the OS2 database.</p>
          </div>
          <span>View leads →</span>
        </button>

        <button className="command-card" onClick={() => onNavigate?.("/pipeline")}>
          <div className="command-card-icon">◫</div>
          <div>
            <div className="eyebrow">REVENUE</div>
            <h2>Pipeline</h2>
            <p>See prospects move from new outreach through reply, audit, meeting and close.</p>
          </div>
          <span>Open pipeline →</span>
        </button>

        <button className="command-card" onClick={() => onNavigate?.("/conversations")}>
          <div className="command-card-icon">◌</div>
          <div>
            <div className="eyebrow">EXECUTION</div>
            <h2>Conversations</h2>
            <p>Review outbound messages, replies and the next action for each conversation.</p>
          </div>
          <span>Open conversations →</span>
        </button>
      </section>

      <section className="card command-health">
        <div>
          <div className="eyebrow">SYSTEM STATUS</div>
          <h2>OS2 is connected to its own operating environment.</h2>
          {loading ? <Skeleton height="24px" /> : <p>Database-backed lead intelligence is active. The Founder view is now organized around the work you actually need to control: leads, pipeline, conversations and team execution.</p>}
        </div>
        <div className="health-pill"><i className="status-dot" /> ONLINE</div>
      </section>
    </div>
  );
};
