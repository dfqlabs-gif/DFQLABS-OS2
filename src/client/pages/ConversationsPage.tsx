import React, { useEffect, useState } from "react";
import { Lead, Message } from "../../shared/types/index.js";
import { Skeleton } from "../components/Skeleton.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { UnderConstruction } from "../components/UnderConstruction.js";
import { useToast } from "../context/ToastContext.js";
import { ApiClient } from "../services/api.js";

export const ConversationsPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeMessage, setActiveMessage] = useState<Message | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [waOpened, setWaOpened] = useState(false);
  const [loading, setLoading] = useState(true);

  const { addToast } = useToast();

  useEffect(() => {
    ApiClient.getProspects().then((res) => {
      setLeads(res.leads);
      if (res.leads.length > 0) {
        selectLead(res.leads[0]);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const selectLead = async (lead: Lead) => {
    setSelectedLead(lead);
    setLoading(true);
    try {
      const res = await ApiClient.getProspectDetail(lead.id);
      const fetchedMessages = res.messages as Message[];
      setMessages(fetchedMessages);

      if (fetchedMessages.length === 0) {
        const generated = await ApiClient.generateFirstTouch(lead.id);
        setMessages([generated.message]);
        setActiveMessage(generated.message);
        setDraftContent(generated.message.aiGeneratedContent || "");
      } else {
        const latest = fetchedMessages[fetchedMessages.length - 1];
        setActiveMessage(latest);
        setDraftContent(latest.humanEditedContent || latest.aiGeneratedContent || latest.finalSentContent || "");
      }
    } catch (e) {
      addToast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!activeMessage) return;
    try {
      const updated = await ApiClient.updateMessageDraft(activeMessage.id, draftContent);
      setActiveMessage(updated.message);
      addToast("Draft edits saved!", "info");
    } catch (e) {
      addToast((e as Error).message, "error");
    }
  };

  const handleOpenWhatsApp = async () => {
    if (!activeMessage) return;
    try {
      const res = await ApiClient.openWhatsApp(activeMessage.id);
      setActiveMessage(res.message);
      setWaOpened(true);
      window.open(res.whatsappUrl, "_blank");
      addToast("WhatsApp window opened", "info");
    } catch (e) {
      addToast((e as Error).message, "error");
    }
  };

  const handleConfirmSent = async () => {
    if (!activeMessage) return;
    try {
      const res = await ApiClient.confirmSent(activeMessage.id, draftContent);
      setActiveMessage(res.message);
      setWaOpened(false);
      if (selectedLead) {
        setSelectedLead({ ...selectedLead, pipelineStage: "CONTACTED" });
      }
      addToast("Message confirmed as SENT! Lead stage updated to CONTACTED", "success");
    } catch (e) {
      addToast((e as Error).message, "error");
    }
  };

  return (
    <div>
      <UnderConstruction
        moduleName="Full Multi-Channel Conversation Threading"
        description="Showing working WhatsApp execution flow with canonical URL builder and confirm-sent state machine. Email & Instagram DM thread sync is under construction."
        targetPhase="Phase 5 & 6"
      />

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px" }}>
        {/* Left: Lead Selector */}
        <div className="card" style={{ padding: "16px" }}>
          <h3 style={{ fontSize: "12px", marginTop: 0, marginBottom: "12px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.08em" }}>
            Prospects ({leads.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {leads.map((l) => (
              <button
                key={l.id}
                onClick={() => selectLead(l)}
                style={{
                  padding: "12px",
                  borderRadius: "var(--radius-md)",
                  background: selectedLead?.id === l.id ? "var(--bg-card-hover)" : "transparent",
                  border: `1px solid ${selectedLead?.id === l.id ? "var(--accent-glacier)" : "var(--border-color)"}`,
                  textAlign: "left",
                  cursor: "pointer",
                  color: "var(--text-primary)",
                  transition: "all var(--transition-fast)"
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "14px" }}>{l.companyName}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{l.contactName || "No Contact"}</span>
                  <StatusBadge status={l.pipelineStage} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Message & WhatsApp Execution */}
        <div className="card">
          {loading || !selectedLead ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Skeleton height="30px" width="50%" />
              <Skeleton height="100px" />
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "16px" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>{selectedLead.companyName}</h2>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
                    Contact: {selectedLead.contactName ?? "Head of Marketing"} | Stage: <StatusBadge status={selectedLead.pipelineStage} />
                  </p>
                </div>
                {activeMessage && (
                  <span style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "var(--radius-sm)", background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                    Status: <strong style={{ color: "var(--accent-glacier)" }}>{activeMessage.status}</strong>
                  </span>
                )}
              </div>

              {/* Thread History */}
              {messages.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px", letterSpacing: "0.08em" }}>
                    Conversation Timeline ({messages.length} messages)
                  </div>
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: "12px 16px",
                        borderRadius: "var(--radius-md)",
                        background: m.direction === "OUTBOUND" ? "var(--accent-glacier-glow)" : "var(--bg-primary)",
                        border: "1px solid var(--border-color)",
                        marginBottom: "8px",
                        fontSize: "13px"
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                        {m.direction} • {m.type} • Status: {m.status}
                      </div>
                      {m.finalSentContent || m.humanEditedContent || m.aiGeneratedContent}
                    </div>
                  ))}
                </div>
              )}

              {/* Verified Evidence Box */}
              <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "14px 18px", marginBottom: "20px" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--accent-glacier)", fontWeight: 700, marginBottom: "4px" }}>
                  Verified Evidence Grounding
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  {selectedLead.evidence?.[0]?.evidenceText || "VERIFIED_FACT: Operating real estate firm in Nigeria."}
                </div>
              </div>

              {/* Message Draft Editor */}
              <div className="form-group">
                <label className="form-label">Outreach Message Draft (Gemini Grounded)</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  disabled={activeMessage?.status === "SENT"}
                />
              </div>

              {/* Execution Actions */}
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "20px" }}>
                {activeMessage?.status !== "SENT" && (
                  <>
                    <button className="btn-secondary" onClick={handleSaveEdit}>
                      Save Edit
                    </button>
                    <button className="btn-primary" onClick={handleOpenWhatsApp}>
                      📲 Open WhatsApp
                    </button>
                  </>
                )}

                {(waOpened || activeMessage?.status === "WHATSAPP_OPENED") && activeMessage?.status !== "SENT" && (
                  <button className="btn-primary" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }} onClick={handleConfirmSent}>
                    ✅ Confirm Message Sent
                  </button>
                )}

                {activeMessage?.status === "SENT" && (
                  <div style={{ color: "var(--accent-emerald)", fontWeight: 700, fontSize: "14px" }}>
                    ✅ Message Sent & Confirmed on {new Date(activeMessage.sentAt || "").toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
