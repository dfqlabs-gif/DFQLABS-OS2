import React, { createContext, useContext, useEffect, useState } from "react";
import { OutreachSeat, User } from "../../shared/types/index.js";
import { ApiClient } from "../services/api.js";

interface AuthContextType {
  user: User | null;
  seat: OutreachSeat | null;
  loading: boolean;
  activeRole: "FOUNDER" | "OUTREACH_SPECIALIST";
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  seat: null,
  loading: true,
  activeRole: "OUTREACH_SPECIALIST"
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [seat, setSeat] = useState<OutreachSeat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
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
  }, []);

  const activeRole = user?.role ?? "OUTREACH_SPECIALIST";
  const login = async (email: string, password: string) => { const result = await ApiClient.login(email, password); ApiClient.setAuthToken(result.token); setUser(result.user); setSeat(result.seat ?? null); };
  const logout = () => { ApiClient.setAuthToken(""); setUser(null); setSeat(null); };

  return (
    <AuthContext.Provider value={{ user, seat, loading, activeRole, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
