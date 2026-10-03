export type UserRole = "FOUNDER" | "OUTREACH_SPECIALIST";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachSeat {
  id: string;
  seatCode: string;
  displayName: string;
  currentUserId: string | null;
  dailyOutreachTarget: number;
  createdAt: string;
  updatedAt: string;
}

export type PipelineStage =
  | "UNCONTACTED"
  | "CONTACTED"
  | "REPLIED"
  | "QUALIFIED"
  | "MEETING_SCHEDULED"
  | "PROPOSAL_SENT"
  | "CLOSED_WON"
  | "CLOSED_LOST"
  | "NURTURE";

export type LeadStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface LeadContact {
  id: string;
  leadId: string;
  contactType: "PHONE" | "WHATSAPP" | "EMAIL";
  rawValue: string;
  normalizedValue: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface LeadSocialProfile {
  id: string;
  leadId: string;
  platform: "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "WEBSITE";
  handleOrUrl: string;
  normalizedIdentifier: string;
  createdAt: string;
}

export interface LeadEvidence {
  id: string;
  leadId: string;
  sourceType: "INSTAGRAM_BIO" | "WEBSITE_PAGE" | "POST_CAPTION" | "MANUAL_NOTE";
  evidenceText: string;
  sourceUrl?: string;
  category: "VERIFIED_FACT" | "REASONABLE_OBSERVATION";
  createdAt: string;
}

export interface Lead {
  id: string;
  companyName: string;
  contactName?: string;
  titleRole?: string;
  businessType?: string;
  location?: string;
  description?: string;
  pipelineStage: PipelineStage;
  status: LeadStatus;
  ownerUserId: string;
  createdByUserId: string;
  lastContactAt?: string;
  nextFollowUpAt?: string;
  createdAt: string;
  updatedAt: string;
  contacts?: LeadContact[];
  socialProfiles?: LeadSocialProfile[];
  evidence?: LeadEvidence[];
}

export interface Conversation {
  id: string;
  leadId: string;
  channel: "WHATSAPP" | "EMAIL" | "INSTAGRAM_DM";
  summary?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type MessageDirection = "OUTBOUND" | "INBOUND";
export type MessageType = "FIRST_TOUCH" | "FOLLOW_UP" | "RESPONSE" | "VALUE_MESSAGE" | "MANUAL";
export type MessageStatus = "GENERATED" | "EDITED" | "APPROVED" | "WHATSAPP_OPENED" | "SENT" | "FAILED";

export interface Message {
  id: string;
  conversationId: string;
  senderUserId?: string;
  direction: MessageDirection;
  type: MessageType;
  aiGeneratedContent?: string;
  humanEditedContent?: string;
  finalSentContent?: string;
  status: MessageStatus;
  evidenceUsed: string[];
  whatsappUrlGenerated?: string;
  createdAt: string;
  sentAt?: string;
}

export interface ActivityEvent {
  id: string;
  eventType:
    | "LEAD_CREATED"
    | "LEAD_ASSIGNED"
    | "DUPLICATE_CHECKED"
    | "BRIEFING_GENERATED"
    | "MESSAGE_GENERATED"
    | "MESSAGE_EDITED"
    | "WHATSAPP_OPENED"
    | "MESSAGE_SENT"
    | "INBOUND_REPLY_RECORDED"
    | "FOLLOW_UP_SCHEDULED"
    | "OUTCOME_RECORDED"
    | "SEAT_REASSIGNED";
  leadId?: string;
  actorUserId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type OutcomeType =
  | "NO_RESPONSE"
  | "REPLIED_POSITIVE"
  | "REPLIED_NEGATIVE"
  | "AUDIT_REQUESTED"
  | "MEETING_SCHEDULED"
  | "PROPOSAL_SENT"
  | "CLOSED_WON"
  | "CLOSED_LOST"
  | "NURTURE";

export interface Outcome {
  id: string;
  leadId: string;
  recordedByUserId: string;
  outcomeType: OutcomeType;
  notes?: string;
  createdAt: string;
}

export interface FocusItem {
  id: string;
  lead: Lead;
  priorityReason: string;
  recommendedAction: string;
  dueAt?: string;
  type: "UNREPLIED_INBOUND" | "OVERDUE_FOLLOW_UP" | "UNCONTACTED_PROSPECT";
}

export interface MissionControlMetrics {
  totalLeads: number;
  uncontactedLeads: number;
  contactedLeads: number;
  repliedLeads: number;
  meetingsScheduled: number;
  outreachGoalTarget: number;
  outreachCompletedToday: number;
  activeSeats: number;
}

export interface DuplicateCheckResult {
  matchType: "EXACT_MATCH" | "POTENTIAL_MATCH" | "NO_MATCH";
  matchedLead?: {
    id: string;
    companyName: string;
    ownerName: string;
  };
  reason?: string;
}
