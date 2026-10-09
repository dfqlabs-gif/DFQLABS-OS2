import React, { useEffect, useState } from "react";
import { Activity, BrainCircuit, LayoutDashboard, MessageCircle, Search, Target, Users, Workflow, Plus, TrendingUp } from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onToggle?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery("");
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { label: "CEO Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Lead Finder", path: "/lead-finder", icon: Search },
    { label: "Lead Directory", path: "/prospects", icon: Users },
    { label: "Pipeline", path: "/pipeline", icon: Workflow },
    { label: "Conversations", path: "/conversations", icon: MessageCircle },
    { label: "Today's Focus", path: "/focus", icon: Target },
    { label: "Add a Prospect", path: "/prospects/new", icon: Plus },
    { label: "Team & Seats", path: "/admin/team", icon: Users },
    { label: "Learning Intelligence", path: "/admin/intelligence", icon: BrainCircuit },
    { label: "Performance", path: "/performance", icon: TrendingUp }
  ];

  const filtered = actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="command-overlay" onClick={onClose}>
      <div className="command-modal" onClick={(e) => e.stopPropagation()}>
        <div className="command-input-wrapper">
          <Search size={17} style={{ marginRight: "12px", color: "var(--accent-glacier)", flexShrink: 0 }} />
          <input
            type="text"
            className="command-input"
            placeholder="Type a command or search workspace..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <span className="kbd-shortcut">ESC to close</span>
        </div>

        <div className="command-results">
          {filtered.length === 0 ? (
            <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "13px" }}>No commands found.</div>
          ) : (
            filtered.map((action) => (
              <div
                key={action.path}
                className="command-item"
                onClick={() => {
                  onNavigate(action.path);
                  onClose();
                }}
              >
                <span className="command-item-icon"><action.icon size={17} strokeWidth={1.8} /></span>
                <span style={{ fontWeight: 500 }}>{action.label}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
