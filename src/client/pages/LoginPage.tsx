import React, { useEffect, useState } from "react";
import { ApiClient } from "../services/api.js";
import { useAuth } from "../context/AuthContext.js";

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"FOUNDER" | "OUTREACH_SPECIALIST">("FOUNDER");
  const [roleEmails, setRoleEmails] = useState<{ FOUNDER: string; OUTREACH_SPECIALIST: string }>({ FOUNDER: "founder@dfqlabs.com", OUTREACH_SPECIALIST: "specialist@dfqlabs.com" });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    ApiClient.getAuthOptions().then(({ roles }) => {
      const founder = roles.find((item) => item.role === "FOUNDER")?.email;
      const specialist = roles.find((item) => item.role === "OUTREACH_SPECIALIST")?.email;
      setRoleEmails({
        FOUNDER: founder || "founder@dfqlabs.com",
        OUTREACH_SPECIALIST: specialist || "specialist@dfqlabs.com"
      });
      setEmail((current) => current || founder || "founder@dfqlabs.com");
    }).catch(() => {
      setEmail((current) => current || "founder@dfqlabs.com");
    });
  }, []);

  const selectRole = (nextRole: "FOUNDER" | "OUTREACH_SPECIALIST") => {
    setRole(nextRole);
    setEmail(roleEmails[nextRole]);
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await login(email.trim(), password);
      // AuthContext updates signed-in state directly, avoiding a full page reload.
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in.";
      setError(message || "Unable to sign in. Please check your connection and try again.");
    } finally { setBusy(false); }
  };

  return <div className="app-container" style={{display:"grid",placeItems:"center",minHeight:"100vh",padding:"24px"}}>
    <form onSubmit={submit} className="card" style={{width:"100%",maxWidth:"430px",padding:"clamp(20px, 6vw, 32px)"}}>
      <div style={{fontSize:"12px",letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--accent-glacier)",fontWeight:800}}>DFQLABS OS 2.0</div>
      <h1 style={{margin:"10px 0 6px",fontSize:"30px"}}>Welcome back.</h1>
      <p style={{color:"var(--text-secondary)",marginBottom:"20px"}}>Choose which workspace you want to sign into.</p>
      <div role="group" aria-label="Choose account role" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"20px"}}>
        <button type="button" onClick={() => selectRole("FOUNDER")} aria-pressed={role === "FOUNDER"} className={role === "FOUNDER" ? "btn-primary" : "btn-ghost"} style={{padding:"12px 8px",border:role === "FOUNDER" ? "1px solid var(--accent-glacier)" : "1px solid var(--border-color)"}}>Founder</button>
        <button type="button" onClick={() => selectRole("OUTREACH_SPECIALIST")} aria-pressed={role === "OUTREACH_SPECIALIST"} className={role === "OUTREACH_SPECIALIST" ? "btn-primary" : "btn-ghost"} style={{padding:"12px 8px",border:role === "OUTREACH_SPECIALIST" ? "1px solid var(--accent-glacier)" : "1px solid var(--border-color)"}}>Outreach Specialist</button>
      </div>
      {error && <div className="form-error" style={{marginBottom:"16px"}}>{error}</div>}
      <div className="form-group"><label className="form-label" htmlFor="login-email">Email</label><input id="login-email" className="form-input" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required /></div>
      <div className="form-group"><label className="form-label" htmlFor="login-password">Password</label><input id="login-password" className="form-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required /></div>
      <button className="btn-primary" style={{width:"100%",marginTop:"8px"}} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  </div>;
};
