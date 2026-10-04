import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  accentColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, description, accentColor }) => {
  return (
    <div className="card" style={{ borderColor: accentColor ? `${accentColor}40` : undefined }}>
      <p className="stat-label">{label}</p>
      <p className="stat-value" style={{ color: accentColor ?? "var(--text-primary)" }}>
        {value}
      </p>
      {description && <p className="stat-desc">{description}</p>}
    </div>
  );
};
