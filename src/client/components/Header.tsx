import React from "react";
import { Search, Command, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext.js";

interface HeaderProps {
  title: string;
  onOpenCommand: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onOpenCommand }) => {
  const { user, seat, activeRole, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="page-title">{title}</h1>
        <button className="command-trigger-btn" onClick={onOpenCommand}>
          <span className="header-search-label"><Search size={15} strokeWidth={1.8} /> Quick Search</span>
          <span className="kbd-shortcut"><Command size={11} /> K</span>
        </button>
      </div>

      <div className="user-profile">
{seat && (
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            Seat: <strong style={{ color: "var(--text-primary)" }}>{seat.displayName}</strong>
          </span>
        )}
        {activeRole !== "FOUNDER" && <span className="role-badge role-specialist">{activeRole === "OUTREACH_SPECIALIST" ? "SPECIALIST" : activeRole}</span>}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "13px", fontWeight: 600 }}>{activeRole === "FOUNDER" ? "Founder" : (user?.fullName ?? "Loading...")}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{user?.email}</div>
          <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "2px" }}>{activeRole === "FOUNDER" ? "Founder workspace" : "Outreach Specialist workspace"}</div>
        </div>
        <button type="button" onClick={logout} className="btn-ghost" title="Log out and switch account" aria-label="Log out and switch account" style={{display:"inline-flex",alignItems:"center",gap:"7px",marginLeft:"12px",whiteSpace:"nowrap"}}>
          <LogOut size={15} /> <span>Log out</span>
        </button>
      </div>
    </header>
  );
};
