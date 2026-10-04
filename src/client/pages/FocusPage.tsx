import React, { useEffect, useState } from "react";
import { FocusItem } from "../../shared/types/index.js";
import { StatCard } from "../components/StatCard.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { ApiClient } from "../services/api.js";

export const FocusPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [items, setItems] = useState<FocusItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ApiClient.getTodayFocus()
      .then((res) => setItems(res.focusItems))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="grid-stats">
        <StatCard label="Today's Outreach Goal" value="30" description="Daily target capacity for Seat A" accentColor="#00d4ff" />
        <StatCard label="Pending Focus Actions" value={items.length} description="Leads requiring execution today" />
        <StatCard label="Unreplied Inbound" value={items.filter((i) => i.type === "UNREPLIED_INBOUND").length} description="High priority response items" accentColor="#10b981" />
      </div>

      <div className="card">
        <h2 style={{ fontSize: "16px", marginTop: 0, marginBottom: "16px" }}>Action Priority Stack</h2>

        {loading ? (
          <p style={{ color: "var(--text-secondary)" }}>Loading Focus items...</p>
        ) : items.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>🎉 All caught up for today! No pending outreach actions or overdue follow-ups.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: "10px",
                  padding: "16px",
                  background: "var(--bg-primary)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span style={{ fontWeight: 700, fontSize: "16px" }}>{item.lead.companyName}</span>
                    <StatusBadge status={item.lead.pipelineStage} />
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--accent-amber)", fontWeight: 500, marginBottom: "4px" }}>
                    Reason: {item.priorityReason}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                    Recommended: {item.recommendedAction}
                  </div>
                </div>

                <button
                  className="btn-primary"
                  onClick={() => onNavigate(`/conversations`)}
                >
                  Execute Action
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
