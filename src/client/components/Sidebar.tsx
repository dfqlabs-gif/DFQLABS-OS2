import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.js";

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { activeRole } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

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
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div>
        <div className="brand-header">
          <div className="brand-logo">OS2</div>
          {!collapsed && (
            <div>
              <div className="brand-title">DFQLABS</div>
              <div className="brand-subtitle">Lead Intelligence</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {!collapsed && (
            <div className="nav-section-label">
              {activeRole === "FOUNDER" ? "Founder Command" : "Specialist Hub"}
            </div>
          )}
          <button
            className="btn-ghost"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            style={{ padding: "4px 8px", fontSize: "12px" }}
          >
            {collapsed ? "➡️" : "◀"}
          </button>
        </div>

        <nav className="nav-links">
          {navItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${currentPath === item.path ? "active" : ""}`}
              onClick={() => onNavigate(item.path)}
              title={item.label}
            >
              <span>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      {!collapsed && (
        <div style={{ fontSize: "11px", color: "var(--text-muted)", padding: "12px 8px", borderTop: "1px solid var(--border-color)" }}>
          DFQLABS OS 2.0
          <br />
          System: <span style={{ color: "var(--accent-emerald)", fontWeight: 700 }}>ONLINE</span>
        </div>
      )}
    </aside>
  );
};
