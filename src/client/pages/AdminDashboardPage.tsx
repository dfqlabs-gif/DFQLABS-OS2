import React, { useEffect, useState } from "react";
import { MissionControlMetrics } from "../../shared/types/index.js";
import { StatCard } from "../components/StatCard.js";
import { ApiClient } from "../services/api.js";

export const AdminDashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<MissionControlMetrics | null>(null);

  useEffect(() => {
    ApiClient.getMissionControl().then((res) => setMetrics(res.metrics));
  }, []);

  return (
    <div>
      <div className="grid-stats">
        <StatCard label="Total OS2 Leads" value={metrics?.totalLeads ?? 0} description="Active pipeline prospects" accentColor="#00d4ff" />
        <StatCard label="Uncontacted Prospects" value={metrics?.uncontactedLeads ?? 0} description="Ready for outreach" />
        <StatCard label="Contacted Leads" value={metrics?.contactedLeads ?? 0} description="Outreach sent" />
        <StatCard label="Inbound Replies" value={metrics?.repliedLeads ?? 0} description="Qualified conversations" accentColor="#10b981" />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: "16px" }}>Team Operational Health</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
          Single server-authoritative architecture active. Project B PostgreSQL instance isolated from legacy OS1 database.
          AI Engine strictly enforcing evidence grounding categories (`VERIFIED_FACT`, `REASONABLE_OBSERVATION`, `UNKNOWN`).
        </p>
      </div>
    </div>
  );
};
