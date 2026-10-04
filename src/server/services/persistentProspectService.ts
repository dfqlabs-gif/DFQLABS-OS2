import { Lead, LeadContact, LeadSocialProfile, User } from "../../shared/types/index.js";
import { getSupabaseClient } from "../config/supabase.js";
import { normalizePhone } from "../utils/phoneNormalizer.js";
import { normalizeSocialIdentifier } from "../utils/socialNormalizer.js";
import { DuplicateEngine } from "./duplicateEngine.js";

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

export class PersistentProspectService {
  static available(): boolean { return Boolean(getSupabaseClient()); }

  static async ensureUser(user: User): Promise<void> {
    const db = getSupabaseClient();
    if (!db) return;
    await db.from("users").upsert({
      id: user.id, email: user.email, full_name: user.fullName, role: user.role,
      is_active: user.isActive, updated_at: new Date().toISOString()
    }, { onConflict: "id" });
    if (user.role === "OUTREACH_SPECIALIST") {
      await db.from("outreach_seats").upsert({
        id: "10000000-0000-0000-0000-000000000001",
        seat_code: "SEAT_A", display_name: "Outreach Seat A", current_user_id: user.id,
        daily_outreach_target: 30, updated_at: new Date().toISOString()
      }, { onConflict: "id" });
    }
  }

  static async list(user: User, query: { search?: string; stage?: string; page?: number; limit?: number }) {
    const db = getSupabaseClient();
    if (!db) return null;
    let q = db.from("leads").select("*", { count: "exact" });
    if (user.role !== "FOUNDER") q = q.eq("owner_user_id", user.id);
    if (query.stage) q = q.eq("pipeline_stage", query.stage);
    if (query.search) q = q.or(`company_name.ilike.%${query.search}%,contact_name.ilike.%${query.search}%,location.ilike.%${query.search}%`);
    const page = Math.max(1, query.page || 1), limit = Math.min(100, Math.max(1, query.limit || 25));
    const { data, count, error } = await q.order("created_at", { ascending: false }).range((page-1)*limit, page*limit-1);
    if (error) throw error;
    return { leads: (data || []).map(r => mapLead(r)), total: count || 0, page, totalPages: Math.ceil((count || 0)/limit) || 1 };
  }

  static async getById(id: string, user: User) {
    const db = getSupabaseClient();
    if (!db) return null;
    let q = db.from("leads").select("*").eq("id", id);
    if (user.role !== "FOUNDER") q = q.eq("owner_user_id", user.id);
    const { data: row, error } = await q.single();
    if (error || !row) return null;
    const [{ data: contacts }, { data: socialProfiles }, { data: evidence }, { data: conversation }] = await Promise.all([
      db.from("lead_contacts").select("*").eq("lead_id", id),
      db.from("lead_social_profiles").select("*").eq("lead_id", id),
      db.from("lead_evidence").select("*").eq("lead_id", id),
      db.from("conversations").select("*").eq("lead_id", id).maybeSingle()
    ]);
    let messages: any[] = [];
    if (conversation) {
      const result = await db.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: true });
      messages = result.data || [];
    }
    return { lead: mapLead(row, (contacts || []).map((x:any)=>({id:x.id,leadId:x.lead_id,contactType:x.contact_type,rawValue:x.raw_value,normalizedValue:x.normalized_value,isPrimary:x.is_primary,createdAt:x.created_at})), (socialProfiles || []).map((x:any)=>({id:x.id,leadId:x.lead_id,platform:x.platform,handleOrUrl:x.handle_or_url,normalizedIdentifier:x.normalized_identifier,createdAt:x.created_at})), evidence || []), contacts: contacts || [], socialProfiles: socialProfiles || [], evidence: evidence || [], conversation, messages };
  }

  static async duplicateCheck(input: {phone?: string; social?: string; website?: string; company?: string}, user: User) {
    const db = getSupabaseClient();
    if (!db) return null;
    const phone = input.phone ? normalizePhone(input.phone) : "";
    const social = input.social ? normalizeSocialIdentifier(input.social) : "";
    const website = input.website ? normalizeSocialIdentifier(input.website) : "";
    if (phone) { const { data } = await db.from("lead_contacts").select("lead_id").eq("normalized_value", phone).limit(1); if (data?.[0]) return { matchType:"EXACT_MATCH" as const, matchedLead:{id:data[0].lead_id,companyName:"Existing lead",ownerName:"Existing owner"},reason:"Normalized phone matches an existing lead."}; }
    for (const [platform, value] of [["INSTAGRAM", social],["WEBSITE", website]] as const) {
      if (!value) continue;
      const { data } = await db.from("lead_social_profiles").select("lead_id").eq("platform", platform).eq("normalized_identifier", value).limit(1);
      if (data?.[0]) return { matchType:"EXACT_MATCH" as const, matchedLead:{id:data[0].lead_id,companyName:"Existing lead",ownerName:"Existing owner"},reason:`Normalized ${platform.toLowerCase()} matches an existing lead.`};
    }
    if (input.company) {
      const { data } = await db.from("leads").select("id,company_name,owner_user_id").ilike("company_name", input.company).limit(1);
      if (data?.[0]) return { matchType:"POTENTIAL_MATCH" as const, matchedLead:{id:data[0].id,companyName:data[0].company_name,ownerName:data[0].owner_user_id},reason:"Company name closely matches an existing lead."};
    }
    return { matchType:"NO_MATCH" as const };
  }

  static async create(input: any, user: User): Promise<Lead> {
    const db = getSupabaseClient();
    if (!db) throw new Error("Database is not configured");
    await this.ensureUser(user);
    const duplicate = await this.duplicateCheck({phone:input.phone,social:input.instagram,website:input.website,company:input.companyName}, user);
    if (duplicate.matchType === "EXACT_MATCH") throw new Error("Duplicate lead: an existing prospect matches this contact or social identifier.");
    const id = crypto.randomUUID(), now = new Date().toISOString();
    const { data: row, error } = await db.from("leads").insert({
      id, company_name: input.companyName, contact_name: input.contactName, title_role: input.titleRole,
      business_type: input.businessType, location: input.location, description: input.description,
      pipeline_stage:"UNCONTACTED", status:"ACTIVE", owner_user_id:user.id, created_by_user_id:user.id,
      created_at:now, updated_at:now
    }).select("*").single();
    if (error || !row) throw new Error(error?.message || "Unable to create lead");
    if (input.phone) await db.from("lead_contacts").insert({lead_id:id,contact_type:"WHATSAPP",raw_value:input.phone,normalized_value:normalizePhone(input.phone),is_primary:true});
    if (input.instagram) await db.from("lead_social_profiles").insert({lead_id:id,platform:"INSTAGRAM",handle_or_url:input.instagram,normalized_identifier:normalizeSocialIdentifier(input.instagram)});
    if (input.website) await db.from("lead_social_profiles").insert({lead_id:id,platform:"WEBSITE",handle_or_url:input.website,normalized_identifier:normalizeSocialIdentifier(input.website)});
    await db.from("conversations").insert({lead_id:id,channel:"WHATSAPP",created_at:now,updated_at:now});
    return mapLead(row);
  }
}
