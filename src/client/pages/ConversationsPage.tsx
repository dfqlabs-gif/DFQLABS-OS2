import React, { useEffect, useMemo, useState } from "react";
import { Lead, Message } from "../../shared/types/index.js";
import { Skeleton } from "../components/Skeleton.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { useToast } from "../context/ToastContext.js";
import { ApiClient } from "../services/api.js";

type ContactIssue = {
  id: string;
  lead_id: string;
  issue_type: "NO_PHONE" | "NOT_ON_WHATSAPP";
  status: "OPEN" | "RESOLVED";
  notes?: string;
  leads?: { company_name?: string; contact_name?: string } | Array<{ company_name?: string; contact_name?: string }>;
};

const PAGE_SIZE = 100;

export const ConversationsPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeMessage, setActiveMessage] = useState<Message | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [waOpened, setWaOpened] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [incoming, setIncoming] = useState("");
  const [manual, setManual] = useState("");
  const [issueType, setIssueType] = useState<"NO_PHONE" | "NOT_ON_WHATSAPP">("NO_PHONE");
  const [notes, setNotes] = useState("");
  const [issues, setIssues] = useState<ContactIssue[]>([]);
  const { addToast } = useToast();

  const openIssues = useMemo(() => issues.filter((issue) => issue.status === "OPEN"), [issues]);
  const blockedLeadIds = useMemo(() => new Set(openIssues.map((issue) => issue.lead_id)), [openIssues]);
  // Open contactability issues are deliberately removed from the normal prospect
  // worklist. They remain accessible in the issue panel until resolved.
  const availableLeads = useMemo(() => leads.filter((lead) => !blockedLeadIds.has(lead.id)), [leads, blockedLeadIds]);

  const refreshIssues = async () => {
    const response = await ApiClient.getContactIssues();
    setIssues(response.issues as ContactIssue[]);
  };

  const refreshThread = async (id: string) => {
    const response = await ApiClient.getProspectDetail(id);
    const sorted = [...response.messages].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    setMessages(sorted);
    setSelectedLead(response.lead);
    const draft = [...sorted].reverse().find((message) => message.direction === "OUTBOUND" && message.status !== "SENT") || null;
    setActiveMessage(draft);
    setDraftContent(draft?.humanEditedContent || draft?.aiGeneratedContent || "");
  };

  const selectLead = async (lead: Lead) => {
    setSelectedLead(lead);
    setLoading(true);
    setWaOpened(false);
    try {
      await refreshThread(lead.id);
    } catch (error) {
      addToast((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (nextPage: number) => {
    const response = await ApiClient.getProspects({ limit: PAGE_SIZE, page: nextPage });
    setLeads((current) => nextPage === 1 ? response.leads : [...current, ...response.leads]);
    setTotalLeads(response.total);
    setPage(nextPage);
    if (nextPage === 1 && response.leads[0]) await selectLead(response.leads[0]);
    else if (nextPage === 1) setLoading(false);
  };

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const [prospects, issueResponse] = await Promise.all([
          ApiClient.getProspects({ limit: PAGE_SIZE, page: 1 }),
          ApiClient.getContactIssues()
        ]);
        if (!active) return;
        setLeads(prospects.leads);
        setTotalLeads(prospects.total);
        setIssues(issueResponse.issues as ContactIssue[]);
        setPage(1);
        if (prospects.leads[0]) await selectLead(prospects.leads[0]);
        else setLoading(false);
      } catch (error) {
        if (active) {
          addToast((error as Error).message, "error");
          setLoading(false);
        }
      }
    };
    void initialize();
    return () => { active = false; };
  }, []);

  const run = (fn: () => Promise<void>) => async () => {
    try { await fn(); }
    catch (error) { addToast((error as Error).message, "error"); }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try { await loadPage(page + 1); }
    catch (error) { addToast((error as Error).message, "error"); }
    finally { setLoadingMore(false); }
  };

  const save = run(async () => {
    if (!activeMessage) return;
    await ApiClient.updateMessageDraft(activeMessage.id, draftContent);
    if (selectedLead) await refreshThread(selectedLead.id);
    addToast("Draft saved.", "success");
  });

  const open = run(async () => {
    if (!activeMessage) return;
    const response = await ApiClient.openWhatsApp(activeMessage.id);
    setActiveMessage(response.message);
    setWaOpened(true);
    window.open(response.whatsappUrl, "_blank", "noopener,noreferrer");
  });

  const confirm = run(async () => {
    if (!activeMessage || !selectedLead) return;
    await ApiClient.confirmSent(activeMessage.id, draftContent);
    setWaOpened(false);
    await refreshThread(selectedLead.id);
    addToast("WhatsApp send confirmed.", "success");
  });

  const generate = run(async () => {
    if (!selectedLead) return;
    await ApiClient.generateFirstTouch(selectedLead.id);
    await refreshThread(selectedLead.id);
  });

  const logIn = run(async () => {
    if (!selectedLead || !incoming.trim()) return;
    const detail = await ApiClient.getProspectDetail(selectedLead.id);
    if (!detail.conversation?.id) throw new Error("Generate a draft first to create this conversation.");
    await ApiClient.logInboundReply(detail.conversation.id, incoming.trim());
    setIncoming("");
    await refreshThread(selectedLead.id);
  });

  const logOut = run(async () => {
    if (!selectedLead || !manual.trim()) return;
    await ApiClient.logManualOutbound(selectedLead.id, manual.trim());
    setManual("");
    await refreshThread(selectedLead.id);
    addToast("Previously sent message logged. No message was sent now.", "success");
  });

  const report = run(async () => {
    if (!selectedLead) return;
    await ApiClient.reportContactIssue(selectedLead.id, issueType, notes);
    setNotes("");
    await refreshIssues();
    addToast("Contact issue recorded. This prospect has been removed from the available outreach list and remains in Open Contact Issues.", "success");
  });

  const resolve = (id: string) => run(async () => {
    const resolutionNotes = window.prompt("Resolution notes (optional):") || "";
    await ApiClient.resolveContactIssue(id, resolutionNotes);
    await refreshIssues();
    addToast("Issue resolved. The prospect is available in the list again.", "success");
  });

  const issueLeadName = (issue: ContactIssue) => {
    const relation = Array.isArray(issue.leads) ? issue.leads[0] : issue.leads;
    return relation?.company_name || issue.lead_id;
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)", gap: 20 }}>
      <aside className="card" style={{ padding: 16, minWidth: 0 }}>
        <h3>Available prospects ({availableLeads.length}{totalLeads > leads.length ? "+" : ""})</h3>
        <p className="muted-text">Prospects with open contactability issues are moved out of this worklist until resolved.</p>
        {availableLeads.map((lead) => (
          <button key={lead.id} onClick={() => void selectLead(lead)} style={{ display: "block", width: "100%", textAlign: "left", padding: 12, marginBottom: 8, borderRadius: 8, border: selectedLead?.id === lead.id ? "1px solid var(--accent-glacier)" : "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)" }}>
            <b>{lead.companyName}</b>
            <div>{lead.contactName || "No contact"} · {lead.pipelineStage}</div>
          </button>
        ))}
        {availableLeads.length === 0 && !loading && <p>No available prospects. Review the open contact issues below or load more leads.</p>}
        {leads.length < totalLeads && (
          <button className="btn-secondary" style={{ width: "100%", marginTop: 8 }} onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? "Loading…" : `Load more prospects (${leads.length} of ${totalLeads})`}
          </button>
        )}
        <h3 style={{ marginTop: 24 }}>Open contact issues ({openIssues.length})</h3>
        {openIssues.map((issue) => (
          <div key={issue.id} style={{ padding: 10, border: "1px solid var(--border-color)", borderRadius: 8, marginBottom: 8 }}>
            <b>{issueLeadName(issue)}</b>
            <p>{issue.issue_type.replaceAll("_", " ")}</p>
            {issue.notes && <p>{issue.notes}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-secondary" onClick={() => {
                const lead = leads.find((item) => item.id === issue.lead_id);
                if (lead) void selectLead(lead);
                else void ApiClient.getProspectDetail(issue.lead_id).then((detail) => void selectLead(detail.lead)).catch((error) => addToast((error as Error).message, "error"));
              }}>Open prospect</button>
              <button className="btn-secondary" onClick={() => void resolve(issue.id)}>Resolve issue</button>
            </div>
          </div>
        ))}
      </aside>

      <main className="card" style={{ padding: 20, minWidth: 0 }}>
        {loading || !selectedLead ? <Skeleton height="120px" /> : <>
          <h2>{selectedLead.companyName}</h2>
          <p>Contact: {selectedLead.contactName || "Unknown"} · Stage: <StatusBadge status={selectedLead.pipelineStage} /></p>
          <h3>Conversation timeline ({messages.length})</h3>
          {messages.map((message) => (
            <article key={message.id} style={{ padding: 12, marginBottom: 8, borderRadius: 8, background: message.direction === "OUTBOUND" ? "var(--accent-glacier-glow)" : "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
              <small>{message.direction} · {message.type} · {message.status} · {new Date(message.sentAt || message.createdAt).toLocaleString()}</small>
              <p style={{ whiteSpace: "pre-wrap" }}>{message.finalSentContent || message.humanEditedContent || message.aiGeneratedContent}</p>
            </article>
          ))}
          <section>
            <h3>Record incoming message</h3>
            <textarea className="form-textarea" rows={3} value={incoming} onChange={(event) => setIncoming(event.target.value)} placeholder="Paste incoming message" />
            <button className="btn-secondary" onClick={() => void logIn()} disabled={!incoming.trim()}>Record incoming</button>
          </section>
          <section>
            <h3>Log outbound message already sent outside DFQLABS</h3>
            <textarea className="form-textarea" rows={3} value={manual} onChange={(event) => setManual(event.target.value)} placeholder="Paste exact message already sent" />
            <button className="btn-secondary" onClick={() => void logOut()} disabled={!manual.trim()}>Add to timeline</button>
            <small>Logging only; this does not send a message.</small>
          </section>
          <section>
            <h3>Report contactability issue</h3>
            <select className="form-input" value={issueType} onChange={(event) => setIssueType(event.target.value as "NO_PHONE" | "NOT_ON_WHATSAPP")}>
              <option value="NO_PHONE">No phone number</option>
              <option value="NOT_ON_WHATSAPP">Not on WhatsApp</option>
            </select>
            <input className="form-input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" />
            <button className="btn-secondary" onClick={() => void report()}>Report issue</button>
          </section>
          <section style={{ marginTop: 20, borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
            <h3>WhatsApp draft</h3>
            {activeMessage ? <>
              <textarea className="form-textarea" rows={5} value={draftContent} onChange={(event) => setDraftContent(event.target.value)} disabled={activeMessage.status === "SENT"} />
              {activeMessage.status !== "SENT" && <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" onClick={() => void save()}>Save edit</button>
                <button className="btn-primary" onClick={() => void open()}>Open WhatsApp</button>
                {(waOpened || activeMessage.status === "WHATSAPP_OPENED") && <button className="btn-primary" onClick={() => void confirm()}>Confirm sent</button>}
              </div>}
            </> : <button className="btn-primary" onClick={() => void generate()}>Generate first-touch draft</button>}
          </section>
        </>}
      </main>
    </div>
  );
};
