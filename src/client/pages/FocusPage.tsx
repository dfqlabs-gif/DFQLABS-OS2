import React, { useEffect, useState } from "react";
import { FocusItem } from "../../shared/types/index.js";
import { Skeleton } from "../components/Skeleton.js";
import { StatCard } from "../components/StatCard.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { useToast } from "../context/ToastContext.js";
import { ApiClient } from "../services/api.js";

export const FocusPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [items, setItems] = useState<FocusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    ApiClient.getTodayFocus()
      .then((res) => {
        setItems(res.focusItems);
        addToast(`Loaded ${res.focusItems.length} Focus actions for today`, "info");
      })
      .catch((err) => {
        addToast(err.message, "error");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="grid-stats">
        <StatCard label="Today's Outreach Goal" value="30" description="Daily target capacity for Seat A" accentColor="#00d4ff" />
        <StatCard label="Pending Focus Actions" value={loading ? "..." : items.length} description="Leads requiring execution today" />
        <StatCard label="Unreplied Inbound" value={loading ? "..." : items.filter((i) => i.type === "UNREPLIED_INBOUND").length} description="High priority response items" accentColor="#10b981" />
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <h2 style={{ fontSize: "16px", margin: 0, fontWeight: 700 }}>Today's Priority Action Stack</h2>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Target 30 actions / day</span>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Skeleton height="80px" />
            <Skeleton height="80px" />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
            <p style={{ fontSize: "28px", margin: "0 0 8px" }}>🎉</p>
            <p style={{ margin: 0, fontWeight: 600 }}>All caught up for today!</p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 0" }}>No pending outreach actions or overdue follow-ups.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  padding: "18px",
                  background: "var(--bg-primary)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "border-color var(--transition-fast)"
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span style={{ fontWeight: 700, fontSize: "16px" }}>{item.lead.companyName}</span>
                    <StatusBadge status={item.lead.pipelineStage} />
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--accent-amber)", fontWeight: 600, marginBottom: "4px" }}>
                    Reason: {item.priorityReason}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Recommended: {item.recommendedAction}
                  </div>
                </div>

                <button
                  className="btn-primary"
                  onClick={() => {
                    addToast(`Executing action for ${item.lead.companyName}`, "info");
                    onNavigate("/conversations");
                  }}
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
