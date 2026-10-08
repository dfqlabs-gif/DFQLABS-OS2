import { Lead, LeadContact, LeadSocialProfile, LeadEvidence, Message, User } from "../../shared/types/index.js";
import { getSupabaseClient } from "../config/supabase.js";
import { normalizePhone } from "../utils/phoneNormalizer.js";
import { normalizeSocialIdentifier } from "../utils/socialNormalizer.js";
import { AIEngineService } from "./aiEngine.js";
import { WhatsAppService } from "./whatsAppService.js";
import { EventService } from "./eventService.js";

interface LeadRow {
  id: string;
  company_name: string;
  contact_name?: string;
  title_role?: string;
  business_type?: string;
  location?: string;
  description?: string;
  pipeline_stage: Lead["pipelineStage"];
  status: Lead["status"];
  owner_user_id: string;
  created_by_user_id: string;
  last_contact_at?: string;
  next_follow_up_at?: string;
  created_at: string;
  updated_at: string;
}

interface EvidenceRow {
  id: string;
  lead_id: string;
  source_type: LeadEvidence["sourceType"];
  evidence_text: string;
  source_url?: string;
  category: LeadEvidence["category"];
  created_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_user_id?: string;
  direction: Message["direction"];
  type: Message["type"];
  ai_generated_content?: string;
  human_edited_content?: string;
  final_sent_content?: string;
  status: Message["status"];
  evidence_used?: string[];
  whatsapp_url_generated?: string;
  created_at: string;
  sent_at?: string;
}

interface ContactRow {
  id: string;
  lead_id: string;
  contact_type: LeadContact["contactType"];
  raw_value: string;
  normalized_value: string;
  is_primary: boolean;
  created_at: string;
}

interface SocialProfileRow {
  id: string;
  lead_id: string;
  platform: LeadSocialProfile["platform"];
  handle_or_url: string;
  normalized_identifier: string;
  created_at: string;
}

function mapLead(row: LeadRow, contacts: LeadContact[] = [], socialProfiles: LeadSocialProfile[] = [], evidence: LeadEvidence[] = []): Lead {
  return {
    id: row.id, companyName: row.company_name, contactName: row.contact_name, titleRole: row.title_role,
    businessType: row.business_type, location: row.location, description: row.description,
    pipelineStage: row.pipeline_stage, status: row.status, ownerUserId: row.owner_user_id,
    createdByUserId: row.created_by_user_id, lastContactAt: row.last_contact_at,
    nextFollowUpAt: row.next_follow_up_at, createdAt: row.created_at, updatedAt: row.updated_at,
    contacts, socialProfiles, evidence
  };
}

function mapEvidence(row: EvidenceRow): LeadEvidence {
  return { id: row.id, leadId: row.lead_id, sourceType: row.source_type, evidenceText: row.evidence_text, sourceUrl: row.source_url, category: row.category, createdAt: row.created_at };
}

function mapMessage(row: MessageRow): Message {
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
    const leads: LeadRow[] = (data || []) as LeadRow[];
    const ids = leads.map((r) => r.id);
    const [{data:contacts},{data:socials},{data:evidence}] = ids.length ? await Promise.all([
      db.from("lead_contacts").select("*").in("lead_id", ids),
      db.from("lead_social_profiles").select("*").in("lead_id", ids),
      db.from("lead_evidence").select("*").in("lead_id", ids)
    ]) : [{data:[]},{data:[]},{data:[]}];
    const contactRows = (contacts || []) as ContactRow[];
    const socialRows = (socials || []) as SocialProfileRow[];
    const evidenceRows = (evidence || []) as EvidenceRow[];

    return {
      leads: leads.map((r) => mapLead(r,
        contactRows.filter((x) => x.lead_id === r.id).map((x) => ({id:x.id,leadId:x.lead_id,contactType:x.contact_type,rawValue:x.raw_value,normalizedValue:x.normalized_value,isPrimary:x.is_primary,createdAt:x.created_at})),
        socialRows.filter((x) => x.lead_id === r.id).map((x) => ({id:x.id,leadId:x.lead_id,platform:x.platform,handleOrUrl:x.handle_or_url,normalizedIdentifier:x.normalized_identifier,createdAt:x.created_at})),
        evidenceRows.filter((x) => x.lead_id === r.id).map(mapEvidence))),
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
    const contactRows = (contacts || []) as ContactRow[];
    const socialRows = (socialProfiles || []) as SocialProfileRow[];
    const evidenceRows = (evidence || []) as EvidenceRow[];
    let messages: Message[] = [];
    if (conversation) {
      const {data} = await db.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at",{ascending:true});
      messages = ((data || []) as MessageRow[]).map(mapMessage);
    }
    const leadRow = row as LeadRow;
    return {
      lead: mapLead(leadRow, contactRows.map((x) => ({id:x.id,leadId:x.lead_id,contactType:x.contact_type,rawValue:x.raw_value,normalizedValue:x.normalized_value,isPrimary:x.is_primary,createdAt:x.created_at})),
        socialRows.map((x) => ({id:x.id,leadId:x.lead_id,platform:x.platform,handleOrUrl:x.handle_or_url,normalizedIdentifier:x.normalized_identifier,createdAt:x.created_at})), evidenceRows.map(mapEvidence)),
      contacts: contactRows, socialProfiles: socialRows, evidence: evidenceRows, conversation, messages
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

  static async create(input: {
    companyName: string;
    contactName?: string;
    titleRole?: string;
    businessType?: string;
    location?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    instagram?: string;
    website?: string;
    description?: string;
    clientType?: string;
    source?: string;
    serviceTier?: string;
  }, user: User): Promise<Lead> {
    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured");
    await this.ensureUser(user);
    const duplicate = await this.duplicateCheck({
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      social: input.instagram,
      website: input.website,
      company: input.companyName
    }, user);

    if (!duplicate) {
      throw new Error("Database is not configured");
    }

    if (duplicate.matchType === "EXACT_MATCH") {
      throw new Error("Duplicate lead: an existing prospect matches this contact or social identifier.");
    }
    const id = crypto.randomUUID(), now = new Date().toISOString();
    const { data: row, error } = await db.from("leads").insert({
      id, company_name: input.companyName, contact_name: input.contactName, title_role: input.titleRole,
      business_type: input.businessType, location: input.location, description: input.description,
      client_type: input.clientType, source: input.source, service_tier: input.serviceTier,
      pipeline_stage: "UNCONTACTED", status: "ACTIVE", owner_user_id: user.id, created_by_user_id: user.id,
      created_at: now, updated_at: now
    }).select("*").single();
    if (error || !row) throw new Error(error?.message || "Unable to create lead");

    type InsertContact = { lead_id: string; contact_type: string; raw_value: string; normalized_value: string; is_primary: boolean };
    const contacts: Array<{ lead_id: string; contact_type: string; raw_value: string; normalized_value: string; is_primary: boolean }> = [];
    if (input.phone) contacts.push({ lead_id: id, contact_type: "PHONE", raw_value: input.phone, normalized_value: normalizePhone(input.phone), is_primary: true });
    if (input.whatsapp) contacts.push({ lead_id: id, contact_type: "WHATSAPP", raw_value: input.whatsapp, normalized_value: normalizePhone(input.whatsapp), is_primary: !input.phone });
    if (input.email) contacts.push({ lead_id: id, contact_type: "EMAIL", raw_value: input.email, normalized_value: input.email.trim().toLowerCase(), is_primary: false });
    if (contacts.length) { const { error: e } = await db.from("lead_contacts").insert(contacts); if (e) throw new Error(e.message); }

    type InsertSocial = { lead_id: string; platform: string; handle_or_url: string; normalized_identifier: string };
    const socials: Array<{ lead_id: string; platform: string; handle_or_url: string; normalized_identifier: string }> = [];
    if (input.instagram) socials.push({ lead_id: id, platform: "INSTAGRAM", handle_or_url: input.instagram, normalized_identifier: normalizeSocialIdentifier(input.instagram) });
    if (input.website) socials.push({ lead_id: id, platform: "WEBSITE", handle_or_url: input.website, normalized_identifier: normalizeSocialIdentifier(input.website) });
    if (socials.length) { const { error: e } = await db.from("lead_social_profiles").insert(socials); if (e) throw new Error(e.message); }

    if (input.description) { const { error: e } = await db.from("lead_evidence").insert({ lead_id: id, source_type: "MANUAL_NOTE", evidence_text: input.description, category: "REASONABLE_OBSERVATION" }); if (e) throw new Error(e.message); }
    const { error: ce } = await db.from("conversations").insert({ lead_id: id, channel: "WHATSAPP", created_at: now, updated_at: now });
    if (ce) { await db.from("leads").delete().eq("id", id); throw new Error(ce.message); }

    EventService.logEvent({ eventType: "LEAD_CREATED", leadId: id, actorUserId: user.id, payload: { companyName: input.companyName } });
    return mapLead(
      row as LeadRow,
      contacts.map((x) => ({ id: "", leadId: id, contactType: x.contact_type as LeadContact["contactType"], rawValue: x.raw_value, normalizedValue: x.normalized_value, isPrimary: x.is_primary, createdAt: now })),
      socials.map((x) => ({ id: "", leadId: id, platform: x.platform as LeadSocialProfile["platform"], handleOrUrl: x.handle_or_url, normalizedIdentifier: x.normalized_identifier, createdAt: now })),
      input.description ? [{ id: "", leadId: id, sourceType: "MANUAL_NOTE", evidenceText: input.description, category: "REASONABLE_OBSERVATION", createdAt: now }] : []
    );
  }

  static async update(id: string, input: Partial<{
    companyName: string; contactName: string; titleRole: string; businessType: string; location: string;
    phone: string; whatsapp: string; email: string; instagram: string; website: string; description: string;
    clientType: string; serviceTier: string;
  }>, user: User): Promise<Lead> {
    const db = getSupabaseClient(); if (!db) throw new Error("Database is not configured");
    const existing = await this.getById(id, user);
    if (!existing) throw new Error("Lead not found");
    const now = new Date().toISOString();
    const leadPatch: Record<string, unknown> = { updated_at: now };
    const map: Record<string, string> = {
      companyName: "company_name", contactName: "contact_name", titleRole: "title_role", businessType: "business_type",
      location: "location", description: "description", clientType: "client_type", serviceTier: "service_tier"
    };
    for (const [key, column] of Object.entries(map)) if (input[key as keyof typeof input] !== undefined) leadPatch[column] = input[key as keyof typeof input];
    const { data: row, error } = await db.from("leads").update(leadPatch).eq("id", id).select("*").single();
    if (error || !row) throw new Error(error?.message || "Unable to update lead");

    if (input.phone !== undefined || input.whatsapp !== undefined || input.email !== undefined) {
      await db.from("lead_contacts").delete().eq("lead_id", id);
      const contacts: Array<{ lead_id: string; contact_type: string; raw_value: string; normalized_value: string; is_primary: boolean }> = [];
      if (input.phone) contacts.push({ lead_id: id, contact_type: "PHONE", raw_value: input.phone, normalized_value: normalizePhone(input.phone), is_primary: true });
      if (input.whatsapp) contacts.push({ lead_id: id, contact_type: "WHATSAPP", raw_value: input.whatsapp, normalized_value: normalizePhone(input.whatsapp), is_primary: !input.phone });
      if (input.email) contacts.push({ lead_id: id, contact_type: "EMAIL", raw_value: input.email, normalized_value: input.email.trim().toLowerCase(), is_primary: false });
      if (contacts.length) { const { error: e } = await db.from("lead_contacts").insert(contacts); if (e) throw new Error(e.message); }
    }

    if (input.instagram !== undefined || input.website !== undefined) {
      await db.from("lead_social_profiles").delete().eq("lead_id", id);
      const socials: Array<{ lead_id: string; platform: string; handle_or_url: string; normalized_identifier: string }> = [];
      if (input.instagram) socials.push({ lead_id: id, platform: "INSTAGRAM", handle_or_url: input.instagram, normalized_identifier: normalizeSocialIdentifier(input.instagram) });
      if (input.website) socials.push({ lead_id: id, platform: "WEBSITE", handle_or_url: input.website, normalized_identifier: normalizeSocialIdentifier(input.website) });
      if (socials.length) { const { error: e } = await db.from("lead_social_profiles").insert(socials); if (e) throw new Error(e.message); }
    }
    const refreshed = await this.getById(id, user);
    if (!refreshed) throw new Error("Lead updated but could not be reloaded");
    EventService.logEvent({ eventType: "LEAD_CREATED", leadId: id, actorUserId: user.id, payload: { action: "PROFILE_UPDATED" } });
    return refreshed.lead;
  }

  static async delete(id: string, user: User): Promise<void> {
    const db = getSupabaseClient(); if (!db) throw new Error("Database is not configured");
    const existing = await this.getById(id, user);
    if (!existing) throw new Error("Lead not found");
    const { error } = await db.from("leads").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  static async generateFirstTouch(leadId: string, user: User): Promise<Message> {
    const detail = await this.getById(leadId, user);
    if (!detail) throw new Error("Lead not found");
    const { draftText, evidenceUsed } = await AIEngineService.generateFirstTouch(detail.lead);

    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured");

    let conversation = detail.conversation;
    if (!conversation) {
      const { data, error } = await db.from("conversations").insert({ lead_id: leadId, channel: "WHATSAPP" }).select("*").single();
      if (error || !data) throw new Error("Conversation unavailable");
      conversation = data;
    }
    if (!conversation) throw new Error("Conversation unavailable");

    const { data, error } = await db.from("messages").insert({
      conversation_id: conversation.id,
      sender_user_id: user.id,
      direction: "OUTBOUND",
      type: "FIRST_TOUCH",
      ai_generated_content: draftText,
      human_edited_content: draftText,
      status: "GENERATED",
      evidence_used: evidenceUsed
    }).select("*").single();

    if (error || !data) throw new Error(error?.message || "Unable to generate message");
    EventService.logEvent({ eventType: "MESSAGE_GENERATED", leadId, actorUserId: user.id, payload: { messageId: data.id } });
    return mapMessage(data as MessageRow);
  }

  static async updateMessageDraft(id: string, editedContent: string, user: User): Promise<Message> {
    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured");
    const { data: msg, error } = await db.from("messages").select("*").eq("id", id).single();
    if (error || !msg) throw new Error("Message not found");
    const { error: e } = await db.from("messages").update({ human_edited_content: editedContent, status: "EDITED" }).eq("id", id);
    if (e) throw new Error(e.message);
    await db.from("message_edits").insert({ message_id: id, user_id: user.id, original_ai_content: msg.ai_generated_content || "", edited_content: editedContent, edit_distance: Math.abs((msg.ai_generated_content || "").length - editedContent.length) });
    EventService.logEvent({ eventType: "MESSAGE_EDITED", actorUserId: user.id, payload: { messageId: id } });
    const { data: updated } = await db.from("messages").select("*").eq("id", id).single();
    return mapMessage(updated as MessageRow);
  }

  static async openWhatsApp(id: string, user: User) {
    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured");
    const { data: msg, error } = await db.from("messages").select("*").eq("id", id).single();
    if (error || !msg) throw new Error("Message not found");

    const { data: conversation } = await db.from("conversations").select("lead_id").eq("id", msg.conversation_id).single();
    if (!conversation) throw new Error("Conversation not found");

    const detail = await this.getById(conversation.lead_id, user);
    if (!detail) throw new Error("Lead not found");

    const phone = detail.lead.contacts?.find((c) => c.contactType === "WHATSAPP" || c.contactType === "PHONE")?.normalizedValue;
    if (!phone) throw new Error("No phone/WhatsApp number is available for this lead.");

    const content = msg.human_edited_content || msg.ai_generated_content || "";
    const url = WhatsAppService.buildTargetUrl(phone, content);
    const { error: e } = await db.from("messages").update({ status: "WHATSAPP_OPENED", whatsapp_url_generated: url }).eq("id", id);
    if (e) throw new Error(e.message);

    EventService.logEvent({ eventType: "WHATSAPP_OPENED", leadId: conversation.lead_id, actorUserId: user.id, payload: { messageId: id } });
    return { message: mapMessage({ ...msg, status: "WHATSAPP_OPENED", whatsapp_url_generated: url } as MessageRow), whatsappUrl: url };
  }

  static async confirmSent(id: string, finalContent: string, user: User) {
    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured");
    const { data: msg, error } = await db.from("messages").select("*").eq("id", id).single();
    if (error || !msg) throw new Error("Message not found");
    if (msg.status !== "WHATSAPP_OPENED") throw new Error("Open WhatsApp before confirming that this message was sent.");

    const { data: conversation } = await db.from("conversations").select("lead_id").eq("id", msg.conversation_id).single();
    if (!conversation) throw new Error("Conversation not found");

    const detail = await this.getById(conversation.lead_id, user);
    if (!detail) throw new Error("Lead not found");

    const sentAt = new Date().toISOString();
    const { data: updated, error: e } = await db.from("messages").update({ final_sent_content: finalContent, human_edited_content: finalContent, status: "SENT", sent_at: sentAt }).eq("id", id).select("*").single();
    if (e || !updated) throw new Error(e?.message || "Unable to confirm sent");

    await db.from("leads").update({ pipeline_stage: "CONTACTED", last_contact_at: sentAt, updated_at: sentAt }).eq("id", conversation.lead_id);
    EventService.logEvent({ eventType: "MESSAGE_SENT", leadId: conversation.lead_id, actorUserId: user.id, payload: { messageId: id, finalContent } });
    return { message: mapMessage(updated as MessageRow), leadStage: "CONTACTED" };
  }

  static async generateFollowUp(leadId: string, user: User): Promise<Message> {
    const detail = await this.getById(leadId, user);
    if (!detail) throw new Error("Lead not found");
    const history = detail.messages.map((m) => ({
      direction: m.direction,
      content: m.finalSentContent || m.humanEditedContent || m.aiGeneratedContent || ""
    })).filter((m) => m.content);
    const { draftText, evidenceUsed } = await AIEngineService.generateFollowUp(detail.lead, history);
    const db = getSupabaseClient();
    if (!db || !detail.conversation) throw new Error("Conversation unavailable");
    const { data, error } = await db.from("messages").insert({
      conversation_id: detail.conversation.id,
      sender_user_id: user.id,
      direction: "OUTBOUND",
      type: "FOLLOW_UP",
      ai_generated_content: draftText,
      human_edited_content: draftText,
      status: "GENERATED",
      evidence_used: evidenceUsed
    }).select("*").single();
    if (error || !data) throw new Error(error?.message || "Unable to generate follow-up");
    EventService.logEvent({ eventType: "MESSAGE_GENERATED", leadId, actorUserId: user.id, payload: { messageId: data.id, messageType: "FOLLOW_UP" } });
    return mapMessage(data as MessageRow);
  }

  static async logInboundReply(id: string, content: string, sentAt: string | undefined, user: User): Promise<Message> {
    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured");
    const { data: conversation, error: conversationError } = await db.from("conversations").select("*").eq("id", id).single();
    if (conversationError || !conversation) throw new Error("Conversation not found");
    const detail = await this.getById(conversation.lead_id, user);
    if (!detail) throw new Error("Lead not found");
    const timestamp = sentAt || new Date().toISOString();
    const { data, error } = await db.from("messages").insert({
      conversation_id: conversation.id,
      sender_user_id: null,
      direction: "INBOUND",
      type: "RESPONSE",
      human_edited_content: content,
      final_sent_content: content,
      status: "SENT",
      evidence_used: [],
      created_at: timestamp,
      sent_at: timestamp
    }).select("*").single();
    if (error || !data) throw new Error(error?.message || "Unable to record inbound reply");
    await db.from("leads").update({ pipeline_stage: "REPLIED", updated_at: new Date().toISOString() }).eq("id", conversation.lead_id);
    await db.from("conversations").update({ last_message_at: timestamp, updated_at: new Date().toISOString() }).eq("id", conversation.id);
    EventService.logEvent({ eventType: "INBOUND_REPLY_RECORDED", leadId: conversation.lead_id, actorUserId: user.id, payload: { messageId: data.id, sentAt: timestamp } });
    return mapMessage(data as MessageRow);
  }
}