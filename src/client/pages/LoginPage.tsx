import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.js";

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      <p style={{color:"var(--text-secondary)",marginBottom:"26px"}}>Sign in to your internal sales command center.</p>
      {error && <div className="form-error" style={{marginBottom:"16px"}}>{error}</div>}
      <div className="form-group"><label className="form-label" htmlFor="login-email">Email</label><input id="login-email" className="form-input" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required /></div>
      <div className="form-group"><label className="form-label" htmlFor="login-password">Password</label><input id="login-password" className="form-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required /></div>
      <button className="btn-primary" style={{width:"100%",marginTop:"8px"}} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  </div>;
};
