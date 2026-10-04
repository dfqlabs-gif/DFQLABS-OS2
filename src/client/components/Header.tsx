import React from "react";
import { useAuth } from "../context/AuthContext.js";

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const { user, seat, activeRole } = useAuth();

  return (
    <header className="header">
      <h1 className="page-title">{title}</h1>
      <div className="user-profile">
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
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{user?.email}</div>
        </div>
      </div>
    </header>
  );
};
