import React, { useEffect, useState } from "react";
import { MissionControlMetrics } from "../../shared/types/index.js";
import { Skeleton } from "../components/Skeleton.js";
import { StatCard } from "../components/StatCard.js";
import { UnderConstruction } from "../components/UnderConstruction.js";
import { ApiClient } from "../services/api.js";

export const PerformancePage: React.FC = () => {
  const [metrics, setMetrics] = useState<MissionControlMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ApiClient.getMissionControl()
      .then((res) => setMetrics(res.metrics))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <UnderConstruction
        moduleName="Specialist Performance & Accountability Analytics"
        description="Showing baseline seat outreach target tracker. Detailed hourly activity heatmaps and edit distance metrics are under construction."
        targetPhase="Phase 8 & 9"
      />

      <div className="grid-stats">
        <StatCard label="Daily Target" value="30 Leads" description="Seat A Capacity Target" accentColor="#00d4ff" />
        <StatCard label="Outreach Sent Today" value={loading ? "..." : (metrics?.outreachCompletedToday ?? 0)} description="Confirmed sent messages" accentColor="#10b981" />
        <StatCard label="Response Rate" value="33%" description="Inbound reply ratio" />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: "16px", fontWeight: 700 }}>Daily Outreach Progress Tracker</h3>
        {loading ? (
          <Skeleton height="16px" style={{ margin: "16px 0" }} />
        ) : (
          <div style={{ background: "var(--bg-primary)", height: "16px", borderRadius: "var(--radius-sm)", overflow: "hidden", margin: "16px 0", border: "1px solid var(--border-color)" }}>
            <div
              style={{
                width: `${Math.min(100, Math.round(((metrics?.outreachCompletedToday ?? 1) / 30) * 100))}%`,
                background: "linear-gradient(90deg, #00d4ff, #10b981)",
                height: "100%",
                transition: "width var(--transition-expressive)"
              }}
            />
          </div>
        )}
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
          Target: 30 messages/day | Current: {metrics?.outreachCompletedToday ?? 0} confirmed sent
        </p>
      </div>
    </div>
  );
};
