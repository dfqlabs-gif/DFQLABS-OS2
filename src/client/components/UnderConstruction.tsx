import React from "react";

interface UnderConstructionProps {
  moduleName: string;
  description: string;
  targetPhase?: string;
}

export const UnderConstruction: React.FC<UnderConstructionProps> = ({ moduleName, description, targetPhase }) => {
  return (
    <div className="construction-banner">
      <div className="construction-icon">🚧</div>
      <div>
        <h3 className="construction-title">{moduleName} — Under Construction</h3>
        <p className="construction-text">
          {description}
          {targetPhase && (
            <span style={{ display: "block", marginTop: "6px", color: "var(--accent-glacier)", fontWeight: 600 }}>
              Implementation scheduled for {targetPhase} per ARCHITECTURE.md execution roadmap.
            </span>
          )}
        </p>
      </div>
    </div>
  );
};
