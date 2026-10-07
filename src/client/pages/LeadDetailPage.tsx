import React, { useEffect, useMemo, useState } from "react";
import { Lead, Message } from "../../shared/types/index.js";
import { ApiClient } from "../services/api.js";
import { useToast } from "../context/ToastContext.js";

export const LeadDetailPage: React.FC<{leadId:string; onNavigate:(path:string)=>void}> = ({leadId,onNavigate}) => {
 const [lead,setLead]=useState<Lead|null>(null);
 const [messages,setMessages]=useState<Message[]>([]);
 const [message,setMessage]=useState<Message|null>(null);
 const [draft,setDraft]=useState("");
 const [inbound,setInbound]=useState("");
 const [busy,setBusy]=useState(true);
 const [opened,setOpened]=useState(false);
 const [conversationId,setConversationId]=useState("");
 const {addToast}=useToast();

 const load=async()=>{
  try{
   const r=await ApiClient.getProspectDetail(leadId);
   setLead(r.lead); setMessages(r.messages);
   const latest=r.messages[r.messages.length-1];
   if(latest && latest.direction==="OUTBOUND" && latest.status!=="SENT"){setMessage(latest);setDraft(latest.humanEditedContent||latest.aiGeneratedContent||"");}
   else {setMessage(null);setDraft("");}
   const detail=r as {lead:Lead; messages:Message[]; conversation?:{id:string}};
   setConversationId(detail.conversation?.id||r.messages[0]?.conversationId||"");
  }catch(e){addToast((e as Error).message,"error")}finally{setBusy(false)}
 };
 useEffect(()=>{load()},[leadId]);

 const generate=async(type:"first"|"followup")=>{
  try{
   const r=type==="first"?await ApiClient.generateFirstTouch(leadId):await ApiClient.generateFollowUp(leadId);
   setMessage(r.message); setDraft(r.message.humanEditedContent||r.message.aiGeneratedContent||"");
   setMessages(prev=>[...prev,r.message]);
   addToast(type==="first"?"First-touch draft generated":"Follow-up draft generated","success");
  }catch(e){addToast((e as Error).message,"error")}
 };

 const save=async()=>{if(!message)return;try{const r=await ApiClient.updateMessageDraft(message.id,draft);setMessage(r.message);setMessages(prev=>prev.map(m=>m.id===r.message.id?r.message:m));addToast("Draft saved","success")}catch(e){addToast((e as Error).message,"error")}};

 const open=async()=>{
  if(!message)return;
  try{
   const w=window.open("about:blank","_blank");
   const r=await ApiClient.openWhatsApp(message.id);
   if(w)w.location.href=r.whatsappUrl; else window.location.href=r.whatsappUrl;
   setMessage(r.message); setMessages(prev=>prev.map(m=>m.id===r.message.id?r.message:m)); setOpened(true);
   addToast("WhatsApp opened — review and send it there","info");
  }catch(e){addToast((e as Error).message,"error")}
 };

 const confirm=async()=>{
  if(!message)return;
  try{
   const r=await ApiClient.confirmSent(message.id,draft);
   setMessage(null); setOpened(false);
   setMessages(prev=>prev.map(m=>m.id===r.message.id?r.message:m));
   setLead(l=>l?{...l,pipelineStage:r.leadStage as Lead["pipelineStage"]}:l);
   addToast("Message confirmed as sent","success");
  }catch(e){addToast((e as Error).message,"error")}
 };

 const recordInbound=async()=>{
  if(!inbound.trim()||!conversationId)return;
  try{
   const r=await ApiClient.logInboundReply(conversationId,inbound.trim());
   setMessages(prev=>[...prev,r.message]); setInbound("");
   setLead(l=>l?{...l,pipelineStage:"REPLIED"}:l);
   addToast("Prospect reply recorded","success");
  }catch(e){addToast((e as Error).message,"error")}
 };

 const conversation=useMemo(()=>messages.filter(m=>m.finalSentContent||m.humanEditedContent||m.aiGeneratedContent),[messages]);

 if(busy)return <div className="card">Loading prospect dossier…</div>;
 if(!lead)return <div className="card">Prospect not found.</div>;

 return <div style={{maxWidth:"1000px",margin:"0 auto"}}>
  <button className="btn-secondary" onClick={()=>onNavigate("/prospects")}>← Back to Prospects</button>
  <div className="card" style={{marginTop:16}}>
   <div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-start"}}>
    <div><div className="eyebrow">PROSPECT DOSSIER</div><h2>{lead.companyName}</h2><p style={{color:"var(--text-secondary)"}}>{lead.contactName||"No contact"} · {lead.titleRole||"Decision maker"} · {lead.location||"Nigeria"}</p></div>
    <strong>{lead.pipelineStage.replaceAll("_"," ")}</strong>
   </div>
   <div style={{marginTop:20,padding:16,background:"var(--bg-primary)",borderRadius:"var(--radius-md)"}}><b>Evidence / context</b><p>{lead.evidence?.map(e=>e.evidenceText).join(" ")||lead.description||"No grounding evidence recorded."}</p></div>

   <section style={{marginTop:24}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div><div className="eyebrow">CONVERSATION</div><h3 style={{margin:0}}>WhatsApp thread</h3></div><button className="btn-secondary" onClick={()=>generate("followup")}>Generate Follow-up</button></div>
    <div style={{display:"grid",gap:10}}>
     {conversation.length===0?<div className="empty-state">No messages yet. Generate the first-touch DM to begin.</div>:conversation.map(m=><div key={m.id} style={{padding:14,borderRadius:12,background:m.direction==="OUTBOUND"?"rgba(0,212,255,.07)":"var(--bg-primary)",border:"1px solid var(--border-color)"}}>
       <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--text-secondary)"}}><span>{m.direction==="OUTBOUND"?"DFQLABS":"PROSPECT"} · {m.type.replaceAll("_"," ")}</span><span>{new Date(m.sentAt||m.createdAt).toLocaleString()}</span></div>
       <div style={{whiteSpace:"pre-wrap",marginTop:8}}>{m.finalSentContent||m.humanEditedContent||m.aiGeneratedContent}</div>
     </div>)}
    </div>
   </section>

   {!message && lead.pipelineStage==="UNCONTACTED" && <button className="btn-primary" style={{marginTop:20}} onClick={()=>generate("first")}>Generate First-Touch DM</button>}

   {message && <div style={{marginTop:20}}><label className="form-label">{message.type==="FOLLOW_UP"?"Follow-up Draft":"First-Touch Draft"}</label><textarea className="form-textarea" rows={7} value={draft} disabled={message.status==="SENT"} onChange={e=>setDraft(e.target.value)}/>
    <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>
     {message.status!=="SENT"&&<><button className="btn-secondary" onClick={save}>Save Edit</button><button className="btn-primary" onClick={open}>📲 Open WhatsApp</button></>}
     {(opened||message.status==="WHATSAPP_OPENED")&&message.status!=="SENT"&&<button className="btn-primary" onClick={confirm}>✓ Confirm Message Sent</button>}
    </div>
   </div>}

   {conversationId && <section style={{marginTop:24,paddingTop:20,borderTop:"1px solid var(--border-color)"}}>
    <div className="eyebrow">INBOUND</div><h3>Record prospect reply</h3>
    <textarea className="form-textarea" rows={4} value={inbound} onChange={e=>setInbound(e.target.value)} placeholder="Paste the prospect's WhatsApp reply here…" />
    <button className="btn-secondary" style={{marginTop:10}} disabled={!inbound.trim()} onClick={recordInbound}>Save Prospect Reply</button>
   </section>}
  </div>
 </div>
};
