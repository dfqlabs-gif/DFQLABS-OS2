import {
  Conversation,
  FocusItem,
  Lead,
  LeadContact,
  LeadEvidence,
  LeadSocialProfile,
  Message,
  MissionControlMetrics,
  Outcome,
  OutreachSeat,
  User
} from "../../shared/types/index.js";
import { getSupabaseClient } from "../config/supabase.js";
import { normalizePhone } from "../utils/phoneNormalizer.js";
import { normalizeSocialIdentifier } from "../utils/socialNormalizer.js";
import { AIEngineService } from "./aiEngine.js";
import { EventService } from "./eventService.js";
import { WhatsAppService } from "./whatsAppService.js";

const founderUser: User = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "founder@dfqlabs.com",
  fullName: "Founder Administrator",
  role: "FOUNDER",
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const specialistUser: User = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "specialist@dfqlabs.com",
  fullName: "Outreach Specialist",
  role: "OUTREACH_SPECIALIST",
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const seatA: OutreachSeat = {
  id: "10000000-0000-0000-0000-000000000001",
  seatCode: "SEAT_A",
  displayName: "Outreach Seat A (Abuja Focus)",
  currentUserId: specialistUser.id,
  dailyOutreachTarget: 30,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const usersStore: User[] = [founderUser, specialistUser];
const seatsStore: OutreachSeat[] = [seatA];
const leadsStore: Lead[] = [];
const conversationsStore: Conversation[] = [];
const messagesStore: Message[] = [];
const outcomesStore: Outcome[] = [];

// Seed initial lead
const seedLeadId = "20000000-0000-0000-0000-000000000001";
const seedContact: LeadContact = {
  id: crypto.randomUUID(),
  leadId: seedLeadId,
  contactType: "WHATSAPP",
  rawValue: "08012345678",
  normalizedValue: "+2348012345678",
  isPrimary: true,
  createdAt: new Date().toISOString()
};
const seedSocial: LeadSocialProfile = {
  id: crypto.randomUUID(),
  leadId: seedLeadId,
  platform: "INSTAGRAM",
  handleOrUrl: "@abcproperties_ng",
  normalizedIdentifier: "abcproperties_ng",
  createdAt: new Date().toISOString()
};
const seedEvidence: LeadEvidence = {
  id: crypto.randomUUID(),
  leadId: seedLeadId,
  sourceType: "INSTAGRAM_BIO",
  evidenceText: "Luxury residential developer in Guzape, Abuja.",
  category: "REASONABLE_OBSERVATION",
  createdAt: new Date().toISOString()
};

const seedLead: Lead = {
  id: seedLeadId,
  companyName: "ABC Properties",
  contactName: "Sarah Ahmed",
  titleRole: "Head of Marketing",
  businessType: "Luxury Residential Developer",
  location: "Abuja, Nigeria",
  description: "Specializes in high-end duplexes in Guzape and Maitama.",
  pipelineStage: "UNCONTACTED",
  status: "ACTIVE",
  ownerUserId: specialistUser.id,
  createdByUserId: specialistUser.id,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  contacts: [seedContact],
  socialProfiles: [seedSocial],
  evidence: [seedEvidence]
};

leadsStore.push(seedLead);

const seedConvId = "30000000-0000-0000-0000-000000000001";
conversationsStore.push({
  id: seedConvId,
  leadId: seedLeadId,
  channel: "WHATSAPP",
  summary: "Initial prospect created.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

export class LeadService {
  public static getUsers(): User[] {
    return [...usersStore];
  }

  public static async getUserByIdAsync(id: string): Promise<User | undefined> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await supabase.from("users").select("*").eq("id", id).single();
      if (data) {
        return {
          id: data.id,
          email: data.email,
          fullName: data.full_name,
          role: data.role,
          isActive: data.is_active,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
      }
    }
    return usersStore.find((u) => u.id === id);
  }

  public static getUserById(id: string): User | undefined {
    return usersStore.find((u) => u.id === id);
  }

  public static getUserByEmail(email: string): User | undefined {
    return usersStore.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public static getSeats(): OutreachSeat[] {
    return [...seatsStore];
  }

  public static async getSeatByUserIdAsync(userId: string): Promise<OutreachSeat | undefined> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await supabase.from("outreach_seats").select("*").eq("current_user_id", userId).single();
      if (data) {
        return {
          id: data.id,
          seatCode: data.seat_code,
          displayName: data.display_name,
          currentUserId: data.current_user_id,
          dailyOutreachTarget: data.daily_outreach_target,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
      }
    }
    return seatsStore.find((s) => s.currentUserId === userId);
  }

  public static getSeatByUserId(userId: string): OutreachSeat | undefined {
    return seatsStore.find((s) => s.currentUserId === userId);
  }

  public static reassignSeat(seatId: string, newUserId: string): OutreachSeat {
    const seat = seatsStore.find((s) => s.id === seatId);
    if (!seat) throw new Error("Seat not found");
    seat.currentUserId = newUserId;
    seat.updatedAt = new Date().toISOString();

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from("outreach_seats").update({ current_user_id: newUserId, updated_at: new Date().toISOString() }).eq("id", seatId);
    }

    return seat;
  }

  public static getAllLeads(user?: User): Lead[] {
    if (!user || user.role === "FOUNDER") {
      return [...leadsStore];
    }
    return leadsStore.filter((l) => l.ownerUserId === user.id);
  }

  public static getLeadById(id: string, user?: User): Lead | undefined {
    const lead = leadsStore.find((l) => l.id === id);
    if (!lead) return undefined;
    if (user && user.role !== "FOUNDER" && lead.ownerUserId !== user.id) {
      return undefined;
    }
    return lead;
  }

  public static async createLead(
    data: {
      companyName: string;
      contactName?: string;
      titleRole?: string;
      businessType?: string;
      location?: string;
      phone?: string;
      instagram?: string;
      website?: string;
      description?: string;
    },
    creator: User
  ): Promise<Lead> {
    const leadId = crypto.randomUUID();
    const now = new Date().toISOString();

    const contacts: LeadContact[] = [];
    if (data.phone) {
      contacts.push({
        id: crypto.randomUUID(),
        leadId,
        contactType: "WHATSAPP",
        rawValue: data.phone,
        normalizedValue: normalizePhone(data.phone),
        isPrimary: true,
        createdAt: now
      });
    }

    const socialProfiles: LeadSocialProfile[] = [];
    if (data.instagram) {
      socialProfiles.push({
        id: crypto.randomUUID(),
        leadId,
        platform: "INSTAGRAM",
        handleOrUrl: data.instagram,
        normalizedIdentifier: normalizeSocialIdentifier(data.instagram),
        createdAt: now
      });
    }
    if (data.website) {
      socialProfiles.push({
        id: crypto.randomUUID(),
        leadId,
        platform: "WEBSITE",
        handleOrUrl: data.website,
        normalizedIdentifier: normalizeSocialIdentifier(data.website),
        createdAt: now
      });
    }

    const evidence: LeadEvidence[] = [];
    if (data.description) {
      evidence.push({
        id: crypto.randomUUID(),
        leadId,
        sourceType: "MANUAL_NOTE",
        evidenceText: data.description,
        category: "VERIFIED_FACT",
        createdAt: now
      });
    }

    const newLead: Lead = {
      id: leadId,
      companyName: data.companyName,
      contactName: data.contactName,
      titleRole: data.titleRole,
      businessType: data.businessType,
      location: data.location,
      description: data.description,
      pipelineStage: "UNCONTACTED",
      status: "ACTIVE",
      ownerUserId: creator.id,
      createdByUserId: creator.id,
      createdAt: now,
      updatedAt: now,
      contacts,
      socialProfiles,
      evidence
    };

    leadsStore.push(newLead);

    const convId = crypto.randomUUID();
    conversationsStore.push({
      id: convId,
      leadId,
      channel: "WHATSAPP",
      createdAt: now,
      updatedAt: now
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from("leads").insert({
        id: leadId,
        company_name: data.companyName,
        contact_name: data.contactName,
        title_role: data.titleRole,
        business_type: data.businessType,
        location: data.location,
        description: data.description,
        pipeline_stage: "UNCONTACTED",
        status: "ACTIVE",
        owner_user_id: creator.id,
        created_by_user_id: creator.id,
        created_at: now,
        updated_at: now
      });
    }

    EventService.logEvent({
      eventType: "LEAD_CREATED",
      leadId,
      actorUserId: creator.id,
      payload: { companyName: data.companyName }
    });

    return newLead;
  }

  public static getConversationForLead(leadId: string): Conversation | undefined {
    return conversationsStore.find((c) => c.leadId === leadId);
  }

  public static getMessagesForConversation(convId: string): Message[] {
    return messagesStore.filter((m) => m.conversationId === convId);
  }

  public static async generateFirstTouch(leadId: string, sender: User): Promise<Message> {
    const lead = leadsStore.find((l) => l.id === leadId);
    if (!lead) throw new Error("Lead not found");

    let conv = conversationsStore.find((c) => c.leadId === leadId);
    if (!conv) {
      conv = {
        id: crypto.randomUUID(),
        leadId,
        channel: "WHATSAPP",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      conversationsStore.push(conv);
    }

    const { draftText, evidenceUsed } = await AIEngineService.generateFirstTouch(lead);
    const primaryPhone = lead.contacts?.find((c) => c.isPrimary)?.normalizedValue ?? "+2348000000000";
    const waUrl = WhatsAppService.buildTargetUrl(primaryPhone, draftText);

    const msg: Message = {
      id: crypto.randomUUID(),
      conversationId: conv.id,
      senderUserId: sender.id,
      direction: "OUTBOUND",
      type: "FIRST_TOUCH",
      aiGeneratedContent: draftText,
      humanEditedContent: draftText,
      status: "GENERATED",
      evidenceUsed,
      whatsappUrlGenerated: waUrl,
      createdAt: new Date().toISOString()
    };

    messagesStore.push(msg);

    EventService.logEvent({
      eventType: "MESSAGE_GENERATED",
      leadId,
      actorUserId: sender.id,
      payload: { messageId: msg.id }
    });

    return msg;
  }

  public static updateMessageDraft(messageId: string, editedContent: string, editor: User): Message {
    const msg = messagesStore.find((m) => m.id === messageId);
    if (!msg) throw new Error("Message not found");

    msg.humanEditedContent = editedContent;
    msg.status = "EDITED";

    EventService.logEvent({
      eventType: "MESSAGE_EDITED",
      actorUserId: editor.id,
      payload: { messageId }
    });

    return msg;
  }

  public static logWhatsAppOpen(messageId: string, user: User): { message: Message; whatsappUrl: string } {
    const msg = messagesStore.find((m) => m.id === messageId);
    if (!msg) throw new Error("Message not found");

    msg.status = "WHATSAPP_OPENED";
    const conv = conversationsStore.find((c) => c.id === msg.conversationId);
    const lead = leadsStore.find((l) => l.id === conv?.leadId);
    const primaryPhone = lead?.contacts?.find((c) => c.isPrimary)?.normalizedValue ?? "+2348000000000";
    const waUrl = WhatsAppService.buildTargetUrl(primaryPhone, msg.humanEditedContent ?? msg.aiGeneratedContent ?? "");

    msg.whatsappUrlGenerated = waUrl;

    EventService.logEvent({
      eventType: "WHATSAPP_OPENED",
      leadId: lead?.id,
      actorUserId: user.id,
      payload: { messageId }
    });

    return { message: msg, whatsappUrl: waUrl };
  }

  public static confirmSent(messageId: string, finalContent: string, user: User): { message: Message; leadStage: string } {
    const msg = messagesStore.find((m) => m.id === messageId);
    if (!msg) throw new Error("Message not found");

    msg.finalSentContent = finalContent;
    msg.status = "SENT";
    msg.sentAt = new Date().toISOString();

    const conv = conversationsStore.find((c) => c.id === msg.conversationId);
    const lead = leadsStore.find((l) => l.id === conv?.leadId);
    if (lead) {
      lead.pipelineStage = "CONTACTED";
      lead.lastContactAt = new Date().toISOString();
      lead.updatedAt = new Date().toISOString();
    }

    EventService.logEvent({
      eventType: "MESSAGE_SENT",
      leadId: lead?.id,
      actorUserId: user.id,
      payload: { messageId, finalContent }
    });

    return { message: msg, leadStage: lead?.pipelineStage ?? "CONTACTED" };
  }

  public static logInboundReply(convId: string, content: string, actor: User): Message {
    const conv = conversationsStore.find((c) => c.id === convId);
    if (!conv) throw new Error("Conversation not found");

    const msg: Message = {
      id: crypto.randomUUID(),
      conversationId: convId,
      direction: "INBOUND",
      type: "RESPONSE",
      finalSentContent: content,
      status: "SENT",
      evidenceUsed: [],
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString()
    };

    messagesStore.push(msg);

    const lead = leadsStore.find((l) => l.id === conv.leadId);
    if (lead) {
      lead.pipelineStage = "REPLIED";
      lead.updatedAt = new Date().toISOString();
    }

    EventService.logEvent({
      eventType: "INBOUND_REPLY_RECORDED",
      leadId: lead?.id,
      actorUserId: actor.id,
      payload: { conversationId: convId, content }
    });

    return msg;
  }

  public static getTodayFocus(user: User): FocusItem[] {
    const userLeads = this.getAllLeads(user);
    const items: FocusItem[] = [];

    for (const lead of userLeads) {
      if (lead.pipelineStage === "UNCONTACTED") {
        items.push({
          id: crypto.randomUUID(),
          lead,
          priorityReason: "Newly added prospect awaiting first outreach.",
          recommendedAction: "Generate and review first-touch WhatsApp message.",
          type: "UNCONTACTED_PROSPECT"
        });
      } else if (lead.pipelineStage === "REPLIED") {
        items.push({
          id: crypto.randomUUID(),
          lead,
          priorityReason: "Prospect replied on WhatsApp.",
          recommendedAction: "Review conversation thread and propose audit call.",
          type: "UNREPLIED_INBOUND"
        });
      }
    }

    return items;
  }

  public static async getMissionControlMetricsAsync(user?: User): Promise<MissionControlMetrics> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.getMissionControlMetrics();

    let query = supabase.from("leads").select("pipeline_stage", { count: "exact", head: false });
    if (user && user.role !== "FOUNDER") query = query.eq("owner_user_id", user.id);
    const { data, error } = await query;
    if (error) throw new Error(`Unable to load Mission Control metrics: ${error.message}`);

    const rows = data || [];
    return {
      totalLeads: rows.length,
      uncontactedLeads: rows.filter((l) => l.pipeline_stage === "UNCONTACTED").length,
      contactedLeads: rows.filter((l) => l.pipeline_stage === "CONTACTED").length,
      repliedLeads: rows.filter((l) => l.pipeline_stage === "REPLIED").length,
      meetingsScheduled: rows.filter((l) => l.pipeline_stage === "MEETING_SCHEDULED").length,
      outreachGoalTarget: 30,
      outreachCompletedToday: 0,
      activeSeats: this.getSeats().length
    };
  }

  public static getMissionControlMetrics(): MissionControlMetrics {
    return {
      totalLeads: leadsStore.length,
      uncontactedLeads: leadsStore.filter((l) => l.pipelineStage === "UNCONTACTED").length,
      contactedLeads: leadsStore.filter((l) => l.pipelineStage === "CONTACTED").length,
      repliedLeads: leadsStore.filter((l) => l.pipelineStage === "REPLIED").length,
      meetingsScheduled: leadsStore.filter((l) => l.pipelineStage === "MEETING_SCHEDULED").length,
      outreachGoalTarget: 30,
      outreachCompletedToday: messagesStore.filter((m) => m.status === "SENT").length,
      activeSeats: seatsStore.length
    };
  }

  public static recordOutcome(leadId: string, outcomeType: Outcome["outcomeType"], notes: string | undefined, actor: User): Outcome {
    const outcome: Outcome = {
      id: crypto.randomUUID(),
      leadId,
      recordedByUserId: actor.id,
      outcomeType,
      notes,
      createdAt: new Date().toISOString()
    };

    outcomesStore.push(outcome);

    const lead = leadsStore.find((l) => l.id === leadId);
    if (lead) {
      if (outcomeType === "MEETING_SCHEDULED") lead.pipelineStage = "MEETING_SCHEDULED";
      if (outcomeType === "CLOSED_WON") lead.pipelineStage = "CLOSED_WON";
      if (outcomeType === "CLOSED_LOST") lead.pipelineStage = "CLOSED_LOST";
      if (outcomeType === "NURTURE") lead.pipelineStage = "NURTURE";
      lead.updatedAt = new Date().toISOString();
    }

    EventService.logEvent({
      eventType: "OUTCOME_RECORDED",
      leadId,
      actorUserId: actor.id,
      payload: { outcomeType, notes }
    });

    return outcome;
  }
}
