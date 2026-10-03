import React from "react";
import { useAuth } from "../context/AuthContext.js";

interface HeaderProps {
  title: string;
  onOpenCommand: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onOpenCommand }) => {
  const { user, seat, activeRole, switchRole } = useAuth();

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="page-title">{title}</h1>
        <button className="command-trigger-btn" onClick={onOpenCommand}>
          <span>🔍 Quick Search</span>
          <span className="kbd-shortcut">⌘K</span>
        </button>
      </div>

      <div className="user-profile">
        <button
          className="role-toggle-btn"
          onClick={() => switchRole(activeRole === "FOUNDER" ? "OUTREACH_SPECIALIST" : "FOUNDER")}
          title="Switch active role workspace session"
        >
          View as: <strong style={{ color: "var(--accent-glacier)" }}>{activeRole === "FOUNDER" ? "Founder" : "Specialist"}</strong> 🔄
        </button>
        {seat && (
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            Seat: <strong style={{ color: "var(--text-primary)" }}>{seat.displayName}</strong>
          </span>
        )}
        <span className={`role-badge ${activeRole === "FOUNDER" ? "role-founder" : "role-specialist"}`}>
          {activeRole}
        </span>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "13px", fontWeight: 600 }}>{user?.fullName ?? "Loading..."}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{user?.email}</div>
        </div>
      </div>
    </header>
  );
};
