import React, { useState } from "react";
import { BrainCircuit, LayoutDashboard, MessageCircle, PanelLeftClose, PanelLeftOpen, Plus, Search, Target, TrendingUp, Users, Workflow } from "lucide-react";
import { useAuth } from "../context/AuthContext.js";

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { activeRole } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const specialistNav = [
    { path: "/focus", label: "Today’s Focus", icon: Target },
    { path: "/lead-finder", label: "Lead Finder", icon: Search },
    { path: "/prospects", label: "My Leads", icon: Users },
    { path: "/prospects/new", label: "Add Prospect", icon: Plus },
    { path: "/conversations", label: "Conversations", icon: MessageCircle },
    { path: "/performance", label: "My Performance", icon: TrendingUp }
  ];

  const founderNav = [
    { path: "/admin/dashboard", label: "CEO Dashboard", icon: LayoutDashboard },
    { path: "/lead-finder", label: "Lead Finder", icon: Search },
    { path: "/prospects", label: "Lead Directory", icon: Users },
    { path: "/pipeline", label: "Pipeline", icon: Workflow },
    { path: "/conversations", label: "Conversations", icon: MessageCircle },
    { path: "/admin/team", label: "Team & Seats", icon: Users },
    { path: "/admin/intelligence", label: "Learning Intelligence", icon: BrainCircuit }
  ];

  const navItems = activeRole === "FOUNDER" ? founderNav : specialistNav;

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div>
        <div className="brand-header">
          <div className="brand-logo">DFQ</div>
          {!collapsed && (
            <div>
              <div className="brand-title">DFQLABS</div>
              <div className="brand-subtitle">Lead Intelligence</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {!collapsed && <div className="nav-section-label">{activeRole === "FOUNDER" ? "Founder Command" : "Specialist Hub"}</div>}
          <button
            className="btn-ghost"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            style={{ padding: "4px 8px", fontSize: "12px" }}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
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
              <span className="nav-icon"><item.icon size={17} strokeWidth={1.8} /></span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      {!collapsed && (
        <div className="sidebar-status">
          <span>DFQLABS</span>
          <span><i className="status-dot" /> SYSTEM ONLINE</span>
        </div>
      )}
    </aside>
  );
};
