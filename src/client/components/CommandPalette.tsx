import React, { useEffect, useState } from "react";

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
    { label: "Go to Today's Focus", path: "/focus", icon: "🎯" },
    { label: "View My Prospects", path: "/prospects", icon: "👥" },
    { label: "Capture New Prospect", path: "/prospects/new", icon: "➕" },
    { label: "Open Conversations", path: "/conversations", icon: "💬" },
    { label: "Specialist Performance", path: "/performance", icon: "📊" },
    { label: "Founder Mission Control", path: "/admin/dashboard", icon: "🚀" },
    { label: "Team & Seats", path: "/admin/team", icon: "🪑" },
    { label: "Learning Intelligence", path: "/admin/intelligence", icon: "🧠" }
  ];

  const filtered = actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="command-overlay" onClick={onClose}>
      <div className="command-modal" onClick={(e) => e.stopPropagation()}>
        <div className="command-input-wrapper">
          <span style={{ marginRight: "12px", color: "var(--accent-glacier)" }}>🔍</span>
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
                <span>{action.icon}</span>
                <span style={{ fontWeight: 500 }}>{action.label}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
