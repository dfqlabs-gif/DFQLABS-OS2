import React, { useState } from "react";
import { DuplicateCheckResult } from "../../shared/types/index.js";
import { useToast } from "../context/ToastContext.js";
import { ApiClient } from "../services/api.js";

export const AddProspectPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [titleRole, setTitleRole] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [clientType, setClientType] = useState("REAL_ESTATE_DEVELOPER");
  const [source, setSource] = useState("MANUAL");
  const [serviceTier, setServiceTier] = useState("STARTER");

  const [dupResult, setDupResult] = useState<DuplicateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { addToast } = useToast();

  const handleDuplicateCheck = async () => {
    if (!companyName && !phone && !instagram && !website) return;
    setChecking(true);
    try {
      const result = await ApiClient.checkDuplicate({
        company: companyName,
        phone,
        whatsapp,
        email,
        social: instagram,
        website
      });
      setDupResult(result);
      if (result.matchType === "EXACT_MATCH") {
        addToast("Exact duplicate prospect found in registry", "warning");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await ApiClient.createProspect({
        companyName,
        contactName,
        titleRole,
        phone,
        whatsapp,
        instagram,
        website,
        email,
        clientType,
        source,
        serviceTier,
        description
      });
      addToast(`Prospect '${companyName}' captured successfully!`, "success");
      onNavigate("/prospects");
    } catch (err) {
      addToast((err as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto" }}>
      <div className="card">
        <h2 style={{ marginTop: 0, marginBottom: "20px", fontSize: "18px", fontWeight: 700 }}>
          Capture New Prospect Dossier
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Company Name *</label>
            <input
              type="text"
              required
              className="form-input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onBlur={handleDuplicateCheck}
              placeholder="e.g. ABC Properties Nigeria"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Contact Name</label>
              <input
                type="text"
                className="form-input"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Sarah Ahmed"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Title / Role</label>
              <input
                type="text"
                className="form-input"
                value={titleRole}
                onChange={(e) => setTitleRole(e.target.value)}
                placeholder="e.g. Head of Marketing"
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Phone / WhatsApp Number</label>
              <input
                type="text"
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={handleDuplicateCheck}
                placeholder="e.g. 08012345678"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Instagram Handle</label>
              <input
                type="text"
                className="form-input"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                onBlur={handleDuplicateCheck}
                placeholder="e.g. @abcproperties_ng"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. marketing@company.com" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-group"><label className="form-label">WhatsApp Number</label><input className="form-input" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} onBlur={handleDuplicateCheck} placeholder="Optional if different from phone" /></div>
            <div className="form-group"><label className="form-label">Client Type</label><select className="form-input" value={clientType} onChange={e=>setClientType(e.target.value)}><option value="REAL_ESTATE_DEVELOPER">Real Estate Developer</option><option value="LUXURY_REALTOR">Luxury Realtor</option><option value="ARCHITECTURE_FIRM">Architecture Firm</option><option value="CONSTRUCTION_FIRM">Construction Firm</option><option value="OTHER">Other</option></select></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-group"><label className="form-label">Source</label><select className="form-input" value={source} onChange={e=>setSource(e.target.value)}><option value="MANUAL">Manual</option><option value="INSTAGRAM">Instagram</option><option value="WEBSITE">Website</option><option value="REFERRAL">Referral</option></select></div>
            <div className="form-group"><label className="form-label">Service Tier</label><select className="form-input" value={serviceTier} onChange={e=>setServiceTier(e.target.value)}><option value="STARTER">Starter — ₦200k/month</option><option value="GROWTH">Growth — ₦500k/month</option><option value="ADVANCED">Advanced — ₦1m/month</option><option value="TRAINING">Training — ₦500k/month</option><option value="CUSTOM">Custom</option></select></div>
          </div>

          <div className="form-group">
            <label className="form-label">Website Domain</label>
            <input
              type="text"
              className="form-input"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              onBlur={handleDuplicateCheck}
              placeholder="e.g. abcproperties.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Evidence / Notes (Grounding Context)</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Verified facts from instagram bio or website to ground AI DM generation"
            />
          </div>

          {checking && <p style={{ fontSize: "12px", color: "var(--accent-glacier)" }}>Checking duplicate registry...</p>}

          {dupResult && dupResult.matchType !== "NO_MATCH" && (
            <div
              style={{
                padding: "14px",
                borderRadius: "var(--radius-md)",
                marginBottom: "20px",
                backgroundColor: dupResult.matchType === "EXACT_MATCH" ? "var(--accent-rose-glow)" : "var(--accent-amber-glow)",
                border: `1px solid ${dupResult.matchType === "EXACT_MATCH" ? "var(--accent-rose)" : "var(--accent-amber)"}`
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>
                {dupResult.matchType === "EXACT_MATCH" ? "🚫 Duplicate Prospect Detected" : "⚠️ Potential Duplicate Detected"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{dupResult.reason}</div>
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || dupResult?.matchType === "EXACT_MATCH"}
            >
              {submitting ? "Saving..." : "Create Prospect"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => onNavigate("/prospects")}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
