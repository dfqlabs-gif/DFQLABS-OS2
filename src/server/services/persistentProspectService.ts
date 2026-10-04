import { Lead, LeadContact, LeadSocialProfile, Message, User } from "../../shared/types/index.js";
import { getSupabaseClient } from "../config/supabase.js";
import { normalizePhone } from "../utils/phoneNormalizer.js";
import { normalizeSocialIdentifier } from "../utils/socialNormalizer.js";
import { AIEngineService } from "./aiEngine.js";
import { WhatsAppService } from "./whatsAppService.js";

function mapLead(row: any, contacts: LeadContact[] = [], socialProfiles: LeadSocialProfile[] = [], evidence: any[] = []): Lead {
  return {
    id: row.id, companyName: row.company_name, contactName: row.contact_name, titleRole: row.title_role,
    businessType: row.business_type, location: row.location, description: row.description,
    pipelineStage: row.pipeline_stage, status: row.status, ownerUserId: row.owner_user_id,
    createdByUserId: row.created_by_user_id, lastContactAt: row.last_contact_at,
    nextFollowUpAt: row.next_follow_up_at, createdAt: row.created_at, updatedAt: row.updated_at,
    contacts, socialProfiles, evidence
  };
}

function mapMessage(row: any): Message {
  return {
    id: row.id, conversationId: row.conversation_id, senderUserId: row.sender_user_id,
    direction: row.direction, type: row.type, aiGeneratedContent: row.ai_generated_content,
    humanEditedContent: row.human_edited_content, finalSentContent: row.final_sent_content,
    status: row.status, evidenceUsed: row.evidence_used || [], whatsappUrlGenerated: row.whatsapp_url_generated,
    createdAt: row.created_at, sentAt: row.sent_at
  };
}

export class PersistentProspectService {
  static available(): boolean { return Boolean(getSupabaseClient()); }

  static async ensureUser(user: User): Promise<void> {
    const db = getSupabaseClient(); if (!db) return;
    const { error } = await db.from("users").upsert({
      id: user.id, email: user.email, full_name: user.fullName, role: user.role,
      is_active: user.isActive, updated_at: new Date().toISOString()
    }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    if (user.role === "OUTREACH_SPECIALIST") {
      const { error: seatError } = await db.from("outreach_seats").upsert({
        id: "10000000-0000-0000-0000-000000000001", seat_code: "SEAT_A", display_name: "Outreach Seat A",
        current_user_id: user.id, daily_outreach_target: 30, updated_at: new Date().toISOString()
      }, { onConflict: "id" });
      if (seatError) throw new Error(seatError.message);
    }
  }

  static async list(user: User, query: { search?: string; stage?: string; page?: number; limit?: number }) {
    const db = getSupabaseClient(); if (!db) return null;
    let q = db.from("leads").select("*", { count: "exact" });
    if (user.role !== "FOUNDER") q = q.eq("owner_user_id", user.id);
    if (query.stage) q = q.eq("pipeline_stage", query.stage);
    if (query.search) q = q.or(`company_name.ilike.%${query.search}%,contact_name.ilike.%${query.search}%,location.ilike.%${query.search}%`);
    const page = Math.max(1, query.page || 1), limit = Math.min(100, Math.max(1, query.limit || 25));
    const { data, count, error } = await q.order("created_at", { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (error) throw new Error(error.message);
    const leads = data || [];
    const ids = leads.map((r:any) => r.id);
    const [{data:contacts},{data:socials},{data:evidence}] = ids.length ? await Promise.all([
      db.from("lead_contacts").select("*").in("lead_id", ids),
      db.from("lead_social_profiles").select("*").in("lead_id", ids),
      db.from("lead_evidence").select("*").in("lead_id", ids)
    ]) : [{data:[]},{data:[]},{data:[]}];
    return {
      leads: leads.map((r:any) => mapLead(r,
        (contacts||[]).filter((x:any)=>x.lead_id===r.id).map((x:any)=>({id:x.id,leadId:x.lead_id,contactType:x.contact_type,rawValue:x.raw_value,normalizedValue:x.normalized_value,isPrimary:x.is_primary,createdAt:x.created_at})),
        (socials||[]).filter((x:any)=>x.lead_id===r.id).map((x:any)=>({id:x.id,leadId:x.lead_id,platform:x.platform,handleOrUrl:x.handle_or_url,normalizedIdentifier:x.normalized_identifier,createdAt:x.created_at})),
        (evidence||[]).filter((x:any)=>x.lead_id===r.id))),
      total: count || 0, page, totalPages: Math.max(1, Math.ceil((count || 0) / limit))
    };
  }

  static async getById(id: string, user: User) {
    const db = getSupabaseClient(); if (!db) return null;
    let q = db.from("leads").select("*").eq("id", id);
    if (user.role !== "FOUNDER") q = q.eq("owner_user_id", user.id);
    const { data: row, error } = await q.single();
    if (error || !row) return null;
    const [{data:contacts},{data:socialProfiles},{data:evidence},{data:conversation}] = await Promise.all([
      db.from("lead_contacts").select("*").eq("lead_id", id),
      db.from("lead_social_profiles").select("*").eq("lead_id", id),
      db.from("lead_evidence").select("*").eq("lead_id", id),
      db.from("conversations").select("*").eq("lead_id", id).maybeSingle()
    ]);
    let messages:any[]=[];
    if (conversation) {
      const {data} = await db.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at",{ascending:true});
      messages=(data||[]).map(mapMessage);
    }
    return {
      lead: mapLead(row,(contacts||[]).map((x:any)=>({id:x.id,leadId:x.lead_id,contactType:x.contact_type,rawValue:x.raw_value,normalizedValue:x.normalized_value,isPrimary:x.is_primary,createdAt:x.created_at})),
        (socialProfiles||[]).map((x:any)=>({id:x.id,leadId:x.lead_id,platform:x.platform,handleOrUrl:x.handle_or_url,normalizedIdentifier:x.normalized_identifier,createdAt:x.created_at})),evidence||[]),
      contacts:contacts||[],socialProfiles:socialProfiles||[],evidence:evidence||[],conversation,messages
    };
  }

  static async duplicateCheck(input:{phone?:string;whatsapp?:string;email?:string;social?:string;website?:string;company?:string}, _user:User) {
    const db=getSupabaseClient(); if(!db) return null;
    const phone=input.phone||input.whatsapp ? normalizePhone(input.phone||input.whatsapp||"") : "";
    if(phone){const {data}=await db.from("lead_contacts").select("lead_id").in("contact_type",["PHONE","WHATSAPP"]).eq("normalized_value",phone).limit(1);if(data?.[0])return {matchType:"EXACT_MATCH" as const,matchedLead:{id:data[0].lead_id,companyName:"Existing lead",ownerName:"Existing owner"},reason:"Normalized phone/WhatsApp number matches an existing lead."};}
    if(input.email){const {data}=await db.from("lead_contacts").select("lead_id").eq("contact_type","EMAIL").eq("normalized_value",input.email.trim().toLowerCase()).limit(1);if(data?.[0])return {matchType:"EXACT_MATCH" as const,matchedLead:{id:data[0].lead_id,companyName:"Existing lead",ownerName:"Existing owner"},reason:"Email matches an existing lead."};}
    for(const [platform,value] of [["INSTAGRAM",input.social],["WEBSITE",input.website]] as const){if(!value)continue;const n=normalizeSocialIdentifier(value);const {data}=await db.from("lead_social_profiles").select("lead_id").eq("platform",platform).eq("normalized_identifier",n).limit(1);if(data?.[0])return {matchType:"EXACT_MATCH" as const,matchedLead:{id:data[0].lead_id,companyName:"Existing lead",ownerName:"Existing owner"},reason:`Normalized ${platform.toLowerCase()} matches an existing lead.`};}
    if(input.company){const {data}=await db.from("leads").select("id,company_name,owner_user_id").ilike("company_name",input.company).limit(1);if(data?.[0])return {matchType:"POTENTIAL_MATCH" as const,matchedLead:{id:data[0].id,companyName:data[0].company_name,ownerName:data[0].owner_user_id},reason:"Company name matches an existing lead."};}
    return {matchType:"NO_MATCH" as const};
  }

  static async create(input:any,user:User):Promise<Lead>{
    const db=getSupabaseClient();if(!db)throw new Error("Database is not configured");
    await this.ensureUser(user);
    const duplicate=await this.duplicateCheck({phone:input.phone,whatsapp:input.whatsapp,email:input.email,social:input.instagram,website:input.website,company:input.companyName},user);
    if(duplicate.matchType==="EXACT_MATCH")throw new Error("Duplicate lead: an existing prospect matches this contact or social identifier.");
    const id=crypto.randomUUID(),now=new Date().toISOString();
    const {data:row,error}=await db.from("leads").insert({id,company_name:input.companyName,contact_name:input.contactName,title_role:input.titleRole,business_type:input.businessType,location:input.location,description:input.description,pipeline_stage:"UNCONTACTED",status:"ACTIVE",owner_user_id:user.id,created_by_user_id:user.id,created_at:now,updated_at:now}).select("*").single();
    if(error||!row)throw new Error(error?.message||"Unable to create lead");
    const contacts:any[]=[];
    if(input.phone)contacts.push({lead_id:id,contact_type:"PHONE",raw_value:input.phone,normalized_value:normalizePhone(input.phone),is_primary:true});
    if(input.whatsapp)contacts.push({lead_id:id,contact_type:"WHATSAPP",raw_value:input.whatsapp,normalized_value:normalizePhone(input.whatsapp),is_primary:!input.phone});
    if(input.email)contacts.push({lead_id:id,contact_type:"EMAIL",raw_value:input.email,normalized_value:input.email.trim().toLowerCase(),is_primary:false});
    if(contacts.length){const {error:e}=await db.from("lead_contacts").insert(contacts);if(e)throw new Error(e.message);}
    const socials:any[]=[];
    if(input.instagram)socials.push({lead_id:id,platform:"INSTAGRAM",handle_or_url:input.instagram,normalized_identifier:normalizeSocialIdentifier(input.instagram)});
    if(input.website)socials.push({lead_id:id,platform:"WEBSITE",handle_or_url:input.website,normalized_identifier:normalizeSocialIdentifier(input.website)});
    if(socials.length){const {error:e}=await db.from("lead_social_profiles").insert(socials);if(e)throw new Error(e.message);}
    if(input.description){const {error:e}=await db.from("lead_evidence").insert({lead_id:id,source_type:"MANUAL_NOTE",evidence_text:input.description,category:"REASONABLE_OBSERVATION"});if(e)throw new Error(e.message);}
    const {error:ce}=await db.from("conversations").insert({lead_id:id,channel:"WHATSAPP",created_at:now,updated_at:now});if(ce)throw new Error(ce.message);
    return mapLead(row,contacts.map((x:any)=>({id:"",leadId:id,contactType:x.contact_type,rawValue:x.raw_value,normalizedValue:x.normalized_value,isPrimary:x.is_primary,createdAt:now})),socials.map((x:any)=>({id:"",leadId:id,platform:x.platform,handleOrUrl:x.handle_or_url,normalizedIdentifier:x.normalized_identifier,createdAt:now})),input.description?[{id:"",leadId:id,sourceType:"MANUAL_NOTE",evidenceText:input.description,category:"REASONABLE_OBSERVATION",createdAt:now}]:[]);
  }

  static async generateFirstTouch(leadId:string,user:User):Promise<Message>{
    const detail=await this.getById(leadId,user);if(!detail)throw new Error("Lead not found");
    const {draftText,evidenceUsed}=await AIEngineService.generateFirstTouch(detail.lead);
    const conversation=detail.conversation || (await getSupabaseClient()!.from("conversations").insert({lead_id:leadId,channel:"WHATSAPP"}).select("*").single()).data;
    if(!conversation)throw new Error("Conversation unavailable");
    const {data,error}=await getSupabaseClient()!.from("messages").insert({conversation_id:conversation.id,sender_user_id:user.id,direction:"OUTBOUND",type:"FIRST_TOUCH",ai_generated_content:draftText,human_edited_content:draftText,status:"GENERATED",evidence_used:evidenceUsed}).select("*").single();
    if(error||!data)throw new Error(error?.message||"Unable to generate message");
    return mapMessage(data);
  }

  static async updateMessageDraft(id:string,editedContent:string,user:User):Promise<Message>{
    const db=getSupabaseClient()!,{data:msg,error}=await db.from("messages").select("*").eq("id",id).single();if(error||!msg)throw new Error("Message not found");
    const {error:e}=await db.from("messages").update({human_edited_content:editedContent,status:"EDITED"}).eq("id",id);if(e)throw new Error(e.message);
    await db.from("message_edits").insert({message_id:id,user_id:user.id,original_ai_content:msg.ai_generated_content||"",edited_content:editedContent,edit_distance:Math.abs((msg.ai_generated_content||"").length-editedContent.length)});
    const {data:updated}=await db.from("messages").select("*").eq("id",id).single();return mapMessage(updated);
  }

  static async openWhatsApp(id:string,user:User){
    const db=getSupabaseClient()!,{data:msg,error}=await db.from("messages").select("*").eq("id",id).single();if(error||!msg)throw new Error("Message not found");
    const {data:conversation}=await db.from("conversations").select("lead_id").eq("id",msg.conversation_id).single();
    const detail=conversation?await this.getById(conversation.lead_id,user):null;if(!detail)throw new Error("Lead not found");
    const phone=detail.lead.contacts?.find(c=>c.contactType==="WHATSAPP"||c.contactType==="PHONE")?.normalizedValue;
    if(!phone)throw new Error("No phone/WhatsApp number is available for this lead.");
    const content=msg.human_edited_content||msg.ai_generated_content||"";
    const url=WhatsAppService.buildTargetUrl(phone,content);
    const {error:e}=await db.from("messages").update({status:"WHATSAPP_OPENED",whatsapp_url_generated:url}).eq("id",id);if(e)throw new Error(e.message);
    return {message:mapMessage({...msg,status:"WHATSAPP_OPENED",whatsapp_url_generated:url}),whatsappUrl:url};
  }

  static async confirmSent(id:string,finalContent:string,user:User){
    const db=getSupabaseClient()!,{data:msg,error}=await db.from("messages").select("*").eq("id",id).single();if(error||!msg)throw new Error("Message not found");
    const {data:conversation}=await db.from("conversations").select("lead_id").eq("id",msg.conversation_id).single();if(!conversation)throw new Error("Conversation not found");
    const detail=await this.getById(conversation.lead_id,user);if(!detail)throw new Error("Lead not found");
    const sentAt=new Date().toISOString();
    const {data:updated,error:e}=await db.from("messages").update({final_sent_content:finalContent,human_edited_content:finalContent,status:"SENT",sent_at:sentAt}).eq("id",id).select("*").single();if(e||!updated)throw new Error(e?.message||"Unable to confirm sent");
    await db.from("leads").update({pipeline_stage:"CONTACTED",last_contact_at:sentAt,updated_at:sentAt}).eq("id",conversation.lead_id);
    return {message:mapMessage(updated),leadStage:"CONTACTED"};
  }
}
