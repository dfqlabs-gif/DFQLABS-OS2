import React from "react";
import { useAuth } from "../context/AuthContext.js";

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { activeRole } = useAuth();

  const specialistNav = [
    { path: "/focus", label: "Today's Focus", icon: "🎯" },
    { path: "/prospects", label: "My Prospects", icon: "👥" },
    { path: "/prospects/new", label: "Add Prospect", icon: "➕" },
    { path: "/conversations", label: "Conversations", icon: "💬" },
    { path: "/performance", label: "My Performance", icon: "📊" }
  ];

  const founderNav = [
    { path: "/admin/dashboard", label: "Mission Control", icon: "🚀" },
    { path: "/admin/team", label: "Team & Seats", icon: "🪑" },
    { path: "/admin/intelligence", label: "Learning Intelligence", icon: "🧠" }
  ];

  const navItems = activeRole === "FOUNDER" ? founderNav : specialistNav;

  return (
    <aside className="sidebar">
      <div>
        <div className="brand-header">
          <div className="brand-logo">OS2</div>
          <div>
            <div className="brand-title">DFQLABS</div>
            <div className="brand-subtitle">Lead Intelligence</div>
          </div>
        </div>

        <div className="nav-section-label">
          {activeRole === "FOUNDER" ? "Founder Workspace" : "Specialist Workspace"}
        </div>
        <nav className="nav-links">
          {navItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${currentPath === item.path ? "active" : ""}`}
              onClick={() => onNavigate(item.path)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div style={{ fontSize: "11px", color: "var(--text-secondary)", padding: "12px 8px" }}>
        DFQLABS OS 2.0 Foundation
        <br />
        System Status: <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>ONLINE</span>
      </div>
    </aside>
  );
};
