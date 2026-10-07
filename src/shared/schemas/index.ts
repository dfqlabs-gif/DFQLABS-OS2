import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Valid email address is required"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

export const DuplicateCheckSchema = z.object({
  phone: z.string().optional(), whatsapp: z.string().optional(), email: z.string().email().optional().or(z.literal("")),
  social: z.string().optional(), website: z.string().optional(), company: z.string().optional()
});

export const CreateProspectSchema = z.object({
  companyName: z.string().min(1, "Company name is required"), contactName: z.string().optional(), titleRole: z.string().optional(),
  businessType: z.string().optional(), location: z.string().optional(), phone: z.string().optional(), whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")), instagram: z.string().optional(), website: z.string().optional(),
  description: z.string().optional(), clientType: z.string().optional(), source: z.string().optional(), serviceTier: z.string().optional()
});

export const GenerateFirstTouchSchema = z.object({
  leadId: z.string().uuid("Valid lead UUID required")
});

export const SaveDraftEditSchema = z.object({
  editedContent: z.string().min(1, "Edited content cannot be empty")
});

export const ConfirmSentSchema = z.object({
  finalContent: z.string().min(1, "Final content is required")
});

export const InboundReplySchema = z.object({
  content: z.string().min(1, "Inbound message content is required"),
  sentAt: z.string().datetime().optional()
});

export const GenerateFollowUpSchema = z.object({ leadId: z.string().uuid("Valid lead UUID required") });

export const RecordOutcomeSchema = z.object({
  leadId: z.string().uuid("Valid lead UUID required"),
  outcomeType: z.enum([
    "NO_RESPONSE",
    "REPLIED_POSITIVE",
    "REPLIED_NEGATIVE",
    "AUDIT_REQUESTED",
    "MEETING_SCHEDULED",
    "PROPOSAL_SENT",
    "CLOSED_WON",
    "CLOSED_LOST",
    "NURTURE"
  ]),
  notes: z.string().optional()
});

export const ReassignSeatSchema = z.object({
  seatId: z.string().uuid("Valid seat UUID required"),
  newUserId: z.string().uuid("Valid user UUID required")
});
