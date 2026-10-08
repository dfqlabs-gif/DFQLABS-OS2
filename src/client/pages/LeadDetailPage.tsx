import React, { useEffect, useMemo, useState } from "react";
import { Lead, Message } from "../../shared/types/index.js";
import { ApiClient } from "../services/api.js";
import { useToast } from "../context/ToastContext.js";

const cleanEvidenceText = (value?: string) => {
  if (!value) return "";
  const decoded = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\\s+/g, " ")
    .trim();
  return decoded.length > 420 ? decoded.slice(0, 420).trimEnd() + "…" : decoded;
};

const field = (label: string, value?: string) => ({ label, value: value || "—" });

export const LeadDetailPage: React.FC<{ leadId: string; onNavigate: (path: string) => void }> = ({ leadId, onNavigate }) => {
  const [lead, setLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState<Message | null>(null);
  const [draft, setDraft] = useState("");
  const [inbound, setInbound] = useState("");
  const [busy, setBusy] = useState(true);
  const [opened, setOpened] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const { addToast } = useToast();

  const load = async () => {
    setBusy(true);
    try {
      const r = await ApiClient.getProspectDetail(leadId);
      setLead(r.lead); setMessages(r.messages);
      setForm({
        companyName: r.lead.companyName || "", contactName: r.lead.contactName || "", titleRole: r.lead.titleRole || "",
        businessType: r.lead.businessType || "", location: r.lead.location || "", phone: r.contacts.find((c: any) => c.contactType === "PHONE")?.normalizedValue || "",
        whatsapp: r.contacts.find((c: any) => c.contactType === "WHATSAPP")?.normalizedValue || "",
        email: r.contacts.find((c: any) => c.contactType === "EMAIL")?.normalizedValue || "",
        instagram: r.socialProfiles.find((c: any) => c.platform === "INSTAGRAM")?.handleOrUrl || "",
        website: r.socialProfiles.find((c: any) => c.platform === "WEBSITE")?.handleOrUrl || "",
        description: r.lead.description || ""
      });
      const latest = r.messages[r.messages.length - 1];
      if (latest && latest.direction === "OUTBOUND" && latest.status !== "SENT") {
        setMessage(latest); setDraft(latest.humanEditedContent || latest.aiGeneratedContent || "");
      } else { setMessage(null); setDraft(""); }
      const detail = r as { lead: Lead; messages: Message[]; conversation?: { id: string } };
      setConversationId(detail.conversation?.id || r.messages[0]?.conversationId || "");
    } catch (e) { addToast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };

  useEffect(() => { load(); }, [leadId]);

  const generate = async (type: "first" | "followup") => {
    try {
      const r = type === "first" ? await ApiClient.generateFirstTouch(leadId) : await ApiClient.generateFollowUp(leadId);
      setMessage(r.message); setDraft(r.message.humanEditedContent || r.message.aiGeneratedContent || "");
      setMessages(prev => [...prev, r.message]);
      addToast(type === "first" ? "First-touch draft generated" : "Follow-up draft generated", "success");
    } catch (e) { addToast((e as Error).message, "error"); }
  };

  const saveDraft = async () => {
    if (!message) return;
    try {
      const r = await ApiClient.updateMessageDraft(message.id, draft);
      setMessage(r.message); setMessages(prev => prev.map(m => m.id === r.message.id ? r.message : m));
      addToast("Message draft saved", "success");
    } catch (e) { addToast((e as Error).message, "error"); }
  };

  const openWhatsApp = async () => {
    if (!message) return;
    try {
      const blank = window.open("about:blank", "_blank");
      const r = await ApiClient.openWhatsApp(message.id);
      if (blank) blank.location.href = r.whatsappUrl; else window.location.href = r.whatsappUrl;
      setMessage(r.message); setMessages(prev => prev.map(m => m.id === r.message.id ? r.message : m)); setOpened(true);
      addToast("WhatsApp opened — verify the recipient before sending", "info");
    } catch (e) { addToast((e as Error).message, "error"); }
  };

  const confirm = async () => {
    if (!message) return;
    try {
      const r = await ApiClient.confirmSent(message.id, draft);
      setMessage(null); setOpened(false);
      setMessages(prev => prev.map(m => m.id === r.message.id ? r.message : m));
      setLead(l => l ? { ...l, pipelineStage: r.leadStage as Lead["pipelineStage"] } : l);
      addToast("Message confirmed as sent", "success");
    } catch (e) { addToast((e as Error).message, "error"); }
  };

  const saveProfile = async () => {
    if (!form.companyName.trim()) { addToast("Company name is required", "error"); return; }
    setSavingProfile(true);
    try {
      const r = await ApiClient.updateProspect(leadId, form);
      setLead(r.lead); setEditing(false); await load();
      addToast("Prospect profile updated", "success");
    } catch (e) { addToast((e as Error).message, "error"); }
    finally { setSavingProfile(false); }
  };

  const deleteProspect = async () => {
    if (!window.confirm("Delete this prospect permanently? This also removes its conversation and messages.")) return;
    setDeleting(true);
    try {
      await ApiClient.deleteProspect(leadId);
      addToast("Prospect deleted", "success");
      onNavigate("/prospects");
    } catch (e) { addToast((e as Error).message, "error"); }
    finally { setDeleting(false); }
  };

  const recordInbound = async () => {
    if (!inbound.trim() || !conversationId) return;
    try {
      const r = await ApiClient.logInboundReply(conversationId, inbound.trim());
      setMessages(prev => [...prev, r.message]); setInbound("");
      setLead(l => l ? { ...l, pipelineStage: "REPLIED" } : l);
      addToast("Prospect reply recorded", "success");
    } catch (e) { addToast((e as Error).message, "error"); }
  };

  const conversation = useMemo(() => messages.filter(m => m.finalSentContent || m.humanEditedContent || m.aiGeneratedContent), [messages]);
  const phone = form.phone || form.whatsapp;
  const social = lead?.socialProfiles || [];
  const evidence = (lead?.evidence || []).map(e => cleanEvidenceText(e.evidenceText)).filter(Boolean).slice(0, 3);

  if (busy) return <div className="card">Loading prospect dossier…</div>;
  if (!lead) return <div className="card">Prospect not found.</div>;

  const profileFields = [
    field("Company", lead.companyName), field("Contact", lead.contactName), field("Role", lead.titleRole),
    field("Business type", lead.businessType), field("Location", lead.location), field("Phone / WhatsApp", phone),
    field("Email", form.email), field("Instagram", social.find(s => s.platform === "INSTAGRAM")?.handleOrUrl),
    field("Website", social.find(s => s.platform === "WEBSITE")?.handleOrUrl)
  ];

  return <div className="prospect-dossier-page">
    <div className="dossier-toolbar">
      <button className="btn-secondary" onClick={() => onNavigate("/prospects")}>← All Prospects</button>
      <div className="dossier-toolbar-actions">
        <button className="btn-secondary" onClick={() => setEditing(v => !v)}>{editing ? "Cancel Edit" : "Edit Profile"}</button>
        <button className="btn-danger" onClick={deleteProspect} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button>
      </div>
    </div>

    <section className="dossier-card">
      <div className="dossier-header">
        <div><div className="eyebrow">PROSPECT PROFILE</div><h1>{lead.companyName}</h1><p>{lead.contactName || "No contact name"} · {lead.titleRole || "Decision maker"} · {lead.location || "Nigeria"}</p></div>
        <div className="dossier-status"><span>{lead.pipelineStage.replaceAll("_", " ")}</span><small>{lead.status}</small></div>
      </div>

      {editing ? <div className="dossier-edit-grid">
        {Object.entries({companyName:"Company",contactName:"Contact",titleRole:"Role",businessType:"Business type",location:"Location",phone:"Phone",whatsapp:"WhatsApp",email:"Email",instagram:"Instagram",website:"Website"}).map(([key,label]) =>
          <label key={key} className="dossier-field"><span>{label}</span><input value={form[key] || ""} onChange={e => setForm(v => ({...v,[key]:e.target.value}))} /></label>
        )}
        <label className="dossier-field dossier-field-wide"><span>Notes</span><textarea value={form.description || ""} onChange={e => setForm(v => ({...v,description:e.target.value}))} /></label>
        <div className="dossier-edit-actions"><button className="btn-primary" onClick={saveProfile} disabled={savingProfile}>{savingProfile ? "Saving…" : "Save Profile"}</button></div>
      </div> : <div className="dossier-info-grid">{profileFields.map(x => <div className="dossier-info" key={x.label}><span>{x.label}</span><strong>{x.value}</strong></div>)}</div>}

      <div className="dossier-meta-row">
        <span>Service tier: <b>{(lead as any).serviceTier || "—"}</b></span>
        <span>Created: <b>{new Date(lead.createdAt).toLocaleDateString()}</b></span>
        {form.phone ? <span className="contact-ready">● Phone available</span> : <span className="contact-missing">● No phone contact</span>}
      </div>
    </section>

    <section className="dossier-card">
      <div className="section-head"><div><div className="eyebrow">RESEARCH SIGNALS</div><h2>What we actually know</h2></div></div>
      {evidence.length ? <div className="evidence-clean">{evidence.map((x,i) => <div key={i}><span>PUBLIC SOURCE</span><p>{x}</p></div>)}</div> : <div className="empty-state">No prospect-specific evidence has been stored.</div>}
      <div className="dossier-links">
        {social.map(s => <a key={s.id + s.platform} href={s.handleOrUrl} target="_blank" rel="noreferrer">{s.platform} ↗</a>)}
      </div>
    </section>

    <section className="dossier-card">
      <div className="section-head"><div><div className="eyebrow">CONVERSATION</div><h2>One unified message thread</h2></div><button className="btn-secondary" onClick={() => generate("followup")}>Generate Follow-up</button></div>
      <div className="thread">
        {conversation.length === 0 ? <div className="empty-state">No messages yet. Generate the first-touch DM to begin.</div> : conversation.map(m =>
          <div key={m.id} className={"thread-message " + (m.direction === "OUTBOUND" ? "outbound" : "inbound")}>
            <div className="thread-message-head"><span>{m.direction === "OUTBOUND" ? "DFQLABS" : "PROSPECT"} · {m.type.replaceAll("_"," ")}</span><span>{new Date(m.sentAt || m.createdAt).toLocaleString()}</span></div>
            <p>{m.finalSentContent || m.humanEditedContent || m.aiGeneratedContent}</p>
          </div>
        )}
      </div>
    </section>

    {!message && lead.pipelineStage === "UNCONTACTED" && <button className="btn-primary" onClick={() => generate("first")}>Generate First-Touch DM</button>}

    {message && <section className="dossier-card draft-card">
      <div className="eyebrow">{message.type === "FOLLOW_UP" ? "FOLLOW-UP DRAFT" : "FIRST-TOUCH DRAFT"}</div>
      <textarea className="form-textarea" rows={8} value={draft} disabled={message.status === "SENT"} onChange={e => setDraft(e.target.value)} />
      <div className="dossier-edit-actions">
        {message.status !== "SENT" && <><button className="btn-secondary" onClick={saveDraft}>Save Edit</button><button className="btn-primary" onClick={openWhatsApp}>📲 Open WhatsApp</button></>}
        {(opened || message.status === "WHATSAPP_OPENED") && message.status !== "SENT" && <button className="btn-primary" onClick={confirm}>✓ Confirm Message Sent</button>}
      </div>
    </section>}

    {conversationId && <section className="dossier-card">
      <div className="eyebrow">INBOUND</div><h2>Record prospect reply</h2>
      <textarea className="form-textarea" rows={4} value={inbound} onChange={e => setInbound(e.target.value)} placeholder="Paste the prospect's WhatsApp reply here…" />
      <button className="btn-secondary" style={{marginTop:10}} disabled={!inbound.trim()} onClick={recordInbound}>Save Prospect Reply</button>
    </section>}
  </div>;
};
