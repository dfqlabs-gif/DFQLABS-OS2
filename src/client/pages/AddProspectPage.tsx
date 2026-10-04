import React, { useState } from "react";
import { DuplicateCheckResult } from "../../shared/types/index.js";
import { ApiClient } from "../services/api.js";

export const AddProspectPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [titleRole, setTitleRole] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  const [dupResult, setDupResult] = useState<DuplicateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleDuplicateCheck = async () => {
    if (!companyName && !phone && !instagram && !website) return;
    setChecking(true);
    try {
      const result = await ApiClient.checkDuplicate({
        company: companyName,
        phone,
        social: instagram,
        website
      });
      setDupResult(result);
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
        instagram,
        website,
        description
      });
      onNavigate("/prospects");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "680px" }}>
      <div className="card">
        <h2 style={{ marginTop: 0, marginBottom: "20px", fontSize: "18px" }}>Capture New Prospect</h2>

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
              placeholder="e.g. ABC Properties"
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
            <label className="form-label">Evidence / Notes</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key facts from social profile or website to ground AI outreach"
            />
          </div>

          {checking && <p style={{ fontSize: "12px", color: "var(--accent-glacier)" }}>Checking duplicate registry...</p>}

          {dupResult && dupResult.matchType !== "NO_MATCH" && (
            <div
              style={{
                padding: "14px",
                borderRadius: "8px",
                marginBottom: "20px",
                backgroundColor: dupResult.matchType === "EXACT_MATCH" ? "rgba(244, 63, 94, 0.15)" : "rgba(245, 158, 11, 0.15)",
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
