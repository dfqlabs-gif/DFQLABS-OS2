import React, { createContext, useContext, useEffect, useState } from "react";
import { OutreachSeat, User } from "../../shared/types/index.js";
import { ApiClient } from "../services/api.js";

interface AuthContextType {
  user: User | null;
  seat: OutreachSeat | null;
  loading: boolean;
  activeRole: "FOUNDER" | "OUTREACH_SPECIALIST";
  switchRole: (role: "FOUNDER" | "OUTREACH_SPECIALIST") => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  seat: null,
  loading: true,
  activeRole: "OUTREACH_SPECIALIST",
  switchRole: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [seat, setSeat] = useState<OutreachSeat | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<"FOUNDER" | "OUTREACH_SPECIALIST">("OUTREACH_SPECIALIST");

  const loadSession = (role: "FOUNDER" | "OUTREACH_SPECIALIST") => {
    setLoading(true);
    const token = role === "FOUNDER" ? "founder-token" : "specialist-token";
    ApiClient.setAuthToken(token);

    ApiClient.getMe()
      .then((res) => {
        setUser(res.user);
        setSeat(res.seat ?? null);
      })
      .catch((e) => {
        console.error("Failed to load auth session", e);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadSession(activeRole);
  }, [activeRole]);

  const switchRole = (role: "FOUNDER" | "OUTREACH_SPECIALIST") => {
    setActiveRole(role);
  };

  return (
    <AuthContext.Provider value={{ user, seat, loading, activeRole, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
