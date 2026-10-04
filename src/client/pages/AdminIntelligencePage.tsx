import React from "react";
import { UnderConstruction } from "../components/UnderConstruction.js";

export const AdminIntelligencePage: React.FC = () => {
  return (
    <div>
      <UnderConstruction
        moduleName="Institutional Learning & Sales Intelligence Engine"
        description="Captures human edit patterns, Levenshtein edit distance diffs, and top converting message hooks. System prompt auto-optimization pipeline is scheduled for Phase 9."
        targetPhase="Phase 9"
      />

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: "16px" }}>Extracted Sales Insights</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
          <div style={{ padding: "14px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-primary)" }}>
            <div style={{ fontWeight: 600, color: "var(--accent-glacier)", fontSize: "14px" }}>
              ABUJA_RESIDENTIAL_HOOKS (Confidence: 92%)
            </div>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
              Citing specific neighborhood projects (e.g. Guzape, Maitama) increases prospect reply rates by 24%.
            </p>
          </div>

          <div style={{ padding: "14px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-primary)" }}>
            <div style={{ fontWeight: 600, color: "var(--accent-glacier)", fontSize: "14px" }}>
              EDIT_PATTERN_FLUFF_REMOVAL (Confidence: 88%)
            </div>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
              Specialists consistently remove formal buzzwords like "synergistic collaboration" in favor of direct value props.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
