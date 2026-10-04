import React from "react";

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  let color = "var(--text-secondary)";
  let bg = "rgba(148, 163, 184, 0.1)";

  switch (status.toUpperCase()) {
    case "UNCONTACTED":
      color = "#60a5fa";
      bg = "rgba(96, 165, 250, 0.15)";
      break;
    case "CONTACTED":
      color = "#f59e0b";
      bg = "rgba(245, 158, 11, 0.15)";
      break;
    case "REPLIED":
    case "QUALIFIED":
    case "MEETING_SCHEDULED":
      color = "#00d4ff";
      bg = "rgba(0, 212, 255, 0.15)";
      break;
    case "CLOSED_WON":
      color = "#10b981";
      bg = "rgba(16, 185, 129, 0.15)";
      break;
    case "CLOSED_LOST":
      color = "#f43f5e";
      bg = "rgba(244, 63, 94, 0.15)";
      break;
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: "var(--radius-sm)",
        fontSize: "11px",
        fontWeight: 700,
        color,
        backgroundColor: bg,
        letterSpacing: "0.04em"
      }}
    >
      {status}
    </span>
  );
};
