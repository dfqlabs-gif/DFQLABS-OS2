import React, { useEffect, useState } from "react";
import { Lead, Message } from "../../shared/types/index.js";
import { ApiClient } from "../services/api.js";
import { useToast } from "../context/ToastContext.js";

export const LeadDetailPage: React.FC<{leadId:string; onNavigate:(path:string)=>void}> = ({leadId,onNavigate}) => {
 const [lead,setLead]=useState<Lead|null>(null); const [message,setMessage]=useState<Message|null>(null); const [draft,setDraft]=useState(""); const [busy,setBusy]=useState(true); const [opened,setOpened]=useState(false); const {addToast}=useToast();
 const load=async()=>{try{const r=await ApiClient.getProspectDetail(leadId); setLead(r.lead); if(r.messages.length){const m=r.messages[r.messages.length-1];setMessage(m);setDraft(m.humanEditedContent||m.aiGeneratedContent||m.finalSentContent||"");}}catch(e){addToast((e as Error).message,"error")}finally{setBusy(false)}};
 useEffect(()=>{load()},[leadId]);
 const generate=async()=>{try{const r=await ApiClient.generateFirstTouch(leadId);setMessage(r.message);setDraft(r.message.aiGeneratedContent||"");addToast("First-touch draft generated","success")}catch(e){addToast((e as Error).message,"error")}};
 const save=async()=>{if(!message)return;const r=await ApiClient.updateMessageDraft(message.id,draft);setMessage(r.message);addToast("Draft saved","success")};
 const open=async()=>{if(!message)return;try{const w=window.open("about:blank","_blank");const r=await ApiClient.openWhatsApp(message.id);if(w)w.location.href=r.whatsappUrl;setMessage(r.message);setOpened(true);addToast("WhatsApp opened — review and send it there","info")}catch(e){addToast((e as Error).message,"error")}};
 const confirm=async()=>{if(!message)return;try{const r=await ApiClient.confirmSent(message.id,draft);setMessage(r.message);setOpened(false);setLead(l=>l?{...l,pipelineStage:r.leadStage as Lead["pipelineStage"]}:l);addToast("Message confirmed as sent","success")}catch(e){addToast((e as Error).message,"error")}};
 if(busy)return <div className="card">Loading prospect dossier…</div>;
 if(!lead)return <div className="card">Prospect not found.</div>;
 return <div style={{maxWidth:"900px",margin:"0 auto"}}>
  <button className="btn-secondary" onClick={()=>onNavigate("/prospects")}>← Back to Prospects</button>
  <div className="card" style={{marginTop:16}}>
   <div style={{display:"flex",justifyContent:"space-between",gap:20}}><div><h2>{lead.companyName}</h2><p style={{color:"var(--text-secondary)"}}>{lead.contactName||"No contact"} · {lead.titleRole||"Decision maker"} · {lead.location||"Nigeria"}</p></div><strong>{lead.pipelineStage}</strong></div>
   <div style={{marginTop:20,padding:16,background:"var(--bg-primary)",borderRadius:"var(--radius-md)"}}><b>Evidence / context</b><p>{lead.evidence?.map(e=>e.evidenceText).join(" ")||lead.description||"No grounding evidence recorded."}</p></div>
   {!message ? <button className="btn-primary" style={{marginTop:20}} onClick={generate}>Generate First-Touch DM</button> :
   <div style={{marginTop:20}}><label className="form-label">First-Touch Message</label><textarea className="form-textarea" rows={7} value={draft} disabled={message.status==="SENT"} onChange={e=>setDraft(e.target.value)}/>
    <div style={{display:"flex",gap:10,marginTop:12}}>
     {message.status!=="SENT"&&<><button className="btn-secondary" onClick={save}>Save Edit</button><button className="btn-primary" onClick={open}>📲 Open WhatsApp</button></>}
     {(opened||message.status==="WHATSAPP_OPENED")&&message.status!=="SENT"&&<button className="btn-primary" onClick={confirm}>✓ Confirm Message Sent</button>}
    </div>
   </div>}
  </div>
 </div>
};
