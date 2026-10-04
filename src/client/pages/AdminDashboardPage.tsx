import React, { useEffect, useState } from "react";
import { MissionControlMetrics } from "../../shared/types/index.js";
import { Skeleton } from "../components/Skeleton.js";
import { StatCard } from "../components/StatCard.js";
import { ApiClient } from "../services/api.js";

export const AdminDashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<MissionControlMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ApiClient.getMissionControl()
      .then((res) => setMetrics(res.metrics))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="grid-stats">
        <StatCard label="Total OS2 Leads" value={loading ? "..." : (metrics?.totalLeads ?? 0)} description="Active pipeline prospects" accentColor="#00d4ff" />
        <StatCard label="Uncontacted Prospects" value={loading ? "..." : (metrics?.uncontactedLeads ?? 0)} description="Ready for outreach" />
        <StatCard label="Contacted Leads" value={loading ? "..." : (metrics?.contactedLeads ?? 0)} description="Outreach sent" />
        <StatCard label="Inbound Replies" value={loading ? "..." : (metrics?.repliedLeads ?? 0)} description="Qualified conversations" accentColor="#10b981" />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: "16px", fontWeight: 700 }}>Team Operational Health & Architecture</h3>
        {loading ? (
          <Skeleton height="60px" />
        ) : (
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.6", margin: 0 }}>
            Single server-authoritative architecture active. Project B PostgreSQL instance isolated from legacy OS1 database.
            AI Engine strictly enforcing evidence grounding categories (<code style={{ color: "var(--accent-glacier)" }}>VERIFIED_FACT</code>, <code style={{ color: "var(--accent-glacier)" }}>REASONABLE_OBSERVATION</code>, <code style={{ color: "var(--accent-glacier)" }}>UNKNOWN</code>).
          </p>
        )}
      </div>
    </div>
  );
};
