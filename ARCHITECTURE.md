# DFQLABS OS 2.0 Product & Architecture Master Blueprint
**Version 1.0 — Greenfield Architecture & Planning Phase**

---

## Executive Summary & Vision

DFQLABS OS 2.0 is a ground-up, greenfield rebuild of the internal operating system powering DFQLABS sales and outreach. OS 2.0 is designed with a singular, overriding philosophy: **Less Software, More Intelligence, Less Clicking, More Execution.**

While OS1 served as a pioneer system, its organic growth created architectural entropy—multiple legacy AI execution paths, duplicated lead states, ungrounded AI prompts, inconsistent WhatsApp URLs, and client-side authoritative mutations. OS 2.0 addresses these structural liabilities by instituting a **single, server-authoritative architecture** built on top of a clean relational database (PostgreSQL via Supabase), unified AI intelligence services (Google Gemini), robust TypeScript backends (Node.js/Express), and a sleek, high-efficiency frontend (React/Vite/Tailwind).

This document serves as the master blueprint for OS 2.0, defining the complete data models, API endpoints, AI intelligence engine, security architecture, testing protocols, migration safeguards, and phased execution plan.

---

## Required Deliverables Summary (A - K)

### A. Core Architecture Decisions
1. **Single Source of Truth:** Server-authoritative business logic and database persistence; zero frontend mutation authority.
2. **Unified Intelligence Engine:** One centralized AI service handling prospect briefing, DM drafting, follow-up recommendations, and learning signal extraction.
3. **Decoupled User and Seat Model:** Users hold identity/credentials; Seats represent operational outreach capacities. Historical activity remains tied to User ID upon seat reassignment.
4. **Canonical WhatsApp Execution Service:** Single server-backed WhatsApp URL generation and state transition service; no decentralized URL string building.
5. **Strict AI Evidence Grounding:** AI classification enforces three strict categories: `VERIFIED_FACT`, `REASONABLE_OBSERVATION`, and `UNKNOWN`. Unsupported claims are strictly prohibited.

### B. Database Schema Overview
14 normalized PostgreSQL tables supporting strong typing, ACID transactions, foreign keys, unique constraints, and Row Level Security (RLS). (See Section 7).

### C. API Map Overview
RESTful TypeScript API with structured JSON payloads, standardized error envelopes, server-enforced role authorization, and event emitting hooks. (See Section 25 & 26).

### D. UI Map Overview
Role-tailored interfaces utilizing the DFQLABS visual design tokens (Near-black background `#090A0F`, Pure white primary text `#FFFFFF`, Glacier Blue accent `#00D4FF`). (See Section 4 & 68).

### E. AI Architecture Overview
Server-side Gemini interface wrapping structured context builders, schema validators, evidence grounding checkers, and learning feedback extractors. (See Section 17-21, 27, 28).

### F. Security Model Overview
Supabase JWT authentication, server-enforced RBAC (Founder vs Outreach Specialist), database Row Level Security, environment secret isolation, and sanitization pipelines. (See Section 8, 9, 36, 37).

### G. Testing Strategy Overview
Layered test architecture encompassing Unit Tests (normalizers, duplicate engines), Integration Tests (transactional DB handlers), AI Boundary Tests (grounding validators), and Playwright E2E end-to-end user workflows. (See Section 52).

### H. Migration Strategy Overview
Read-only extraction from production OS1 database, schema transformation and phone normalization, automated duplicate detection against OS2 baseline, and verified transactional import. (See Section 50, 51, 33).

### I. Implementation Phases Overview
13 structured implementation phases starting from repository foundation and ending at production hardening and migration execution. (See Section 59).

### J. Risk Matrix Overview
Identification of primary architectural risks (e.g., stale state overwrite, WhatsApp popup blocking, AI hallucination) accompanied by concrete technical mitigations. (See Section 38).

### K. Acceptance Criteria Overview
Strict definition of "Done" across all application layers requiring passing automated tests, verified persistence, server authorization, and audit trail generation. (See Section 53).

---

## 1. Executive Summary

DFQLABS OS 2.0 unifies lead intelligence, outreach execution, conversation memory, sales analytics, AI assistance, and institutional learning into a seamless operational tool. The primary objective is to reliably generate qualified business conversations with real estate firms and related enterprises across Nigeria and target markets while reducing specialist cognitive workload by at least 60%.

Key Architectural Tenets:
- **Zero Duplicate Paths:** Exactly one way to query, message, persist, and evaluate leads.
- **Strict Separation of Concerns:** Database stores facts; Server enforces logic; AI interprets and drafts; UI presents and captures actions.
- **Auditability & Traceability:** Immutable event logging for every key action (`LEAD_CREATED`, `MESSAGE_SENT`, `OUTCOME_RECORDED`).

---

## 2. Product Architecture

```
                                +---------------------------+
                                |      React UI (Vite)      |
                                | (Glacier Blue / Dark Theme)|
                                +-------------+-------------+
                                              |
                                              | HTTPS / JWT Auth
                                              v
                                +-------------+-------------+
                                |    Node.js Express API    |
                                |  (Server Authoritative)   |
                                +----+--------+--------+----+
                                     |        |        |
           +-------------------------+        |        +-------------------------+
           |                                  |                                  |
           v                                  v                                  v
+----------+----------+            +----------+----------+            +----------+----------+
|  Supabase Postgres  |            |   Central AI Engine     |            | Canonical WhatsApp  |
| (Tables, RLS, ACID) |            |  (Google Gemini API)    |            |   Execution Service |
+---------------------+            +---------------------+            +---------------------+
```

---

## 3. System Architecture Diagram & Data Flow

```
[Specialist / Founder Browser]
       │
       │ (1) Request Action (e.g. Add Prospect, Generate First Touch)
       ▼
[Express REST API Routing Middleware]
       │
       ├──────► [Auth & RBAC Enforcement Middleware]
       │               │
       │               ▼ (Token Validated)
       ├──────► [Business Logic Services]
       │               │
       │               ├──► [Duplicate Engine / Phone Normalizer]
       │               │
       │               ├──► [AI Context Builder & Gemini API] ──► [Schema & Evidence Validator]
       │               │
       │               └──► [Database Transaction Handler]
       │                       │
       │                       ▼
       └──────────────► [Supabase PostgreSQL (Primary DB)]
                               │
                               ▼
                        [Event Logger] ──► Emits Immutable Audit Event
```

---

## 4. Frontend Architecture

- **Framework:** React 18+ with TypeScript (Strict mode enabled).
- **Build System:** Vite.
- **Styling & Design System:** Tailwind CSS with custom DFQLABS Design Tokens:
  - Background: `#090A0F` (Near Black / Obsidian)
  - Surface Card: `#12141D` (Dark Charcoal)
  - Primary Text: `#FFFFFF` (Pure White)
  - Muted Text: `#94A3B8` (Slate 400)
  - Primary Accent: `#00D4FF` (Glacier Blue)
  - Success/Accent: `#10B981` (Emerald Green)
  - Warning/Alert: `#F59E0B` (Amber)
- **State Management:** React Query (TanStack Query v5) for server-state caching, invalidation, and optimistic updates; React Context for active session state.
- **Component Design:** Atomized component library (`Button`, `Input`, `Badge`, `Modal`, `Table`, `Card`, `StatBox`, `Timeline`).

---

## 5. Backend Architecture

- **Runtime:** Node.js v20 LTS.
- **Framework:** Express.js with TypeScript (`tsx` for dev, `tsc` for production build).
- **Architecture Pattern:** Layered Service Architecture (`Routes` -> `Controllers` -> `Services` -> `Repositories/DB`).
- **Validation:** Zod schemas enforcing input validation on all incoming API requests before controller execution.
- **Error Handling:** Standardized API Error middleware converting system exceptions into uniform RFC 7807 problem details.

---

## 6. Database Architecture

- **Engine:** PostgreSQL 15+ hosted on Supabase (New Project: `DFQLABS OS2`).
- **Isolation:** Project B (OS2) is completely isolated from Project A (OS1 Production DB).
- **Transactions:** Critical composite actions (e.g., `CREATE LEAD` + `ASSIGN OWNER` + `RECORD EVENT`) run within strict PostgreSQL explicit transactions (`BEGIN ... COMMIT`).
- **Performance Strategy:** Composite indexing on highly queried fields (`tenant_id`, `owner_user_id`, `status`, `created_at`).

---

## 7. Complete Proposed Database Schema

### 7.1 Table: `users`
- **Purpose:** Stores identity and auth metadata for DFQLABS team members.
- **Columns:**
  - `id` (UUID, Primary Key, Default: `gen_random_uuid()`) — *Authoritative*
  - `email` (VARCHAR(255), UNIQUE, NOT NULL) — *Authoritative*
  - `full_name` (VARCHAR(255), NOT NULL) — *Authoritative*
  - `role` (VARCHAR(50), NOT NULL, Check: `FOUNDER` | `OUTREACH_SPECIALIST`) — *Authoritative*
  - `is_active` (BOOLEAN, Default: `true`, NOT NULL) — *Authoritative*
  - `created_at` (TIMESTAMPTZ, Default: `now()`, NOT NULL) — *System*
  - `updated_at` (TIMESTAMPTZ, Default: `now()`, NOT NULL) — *System*
- **Indexes:** `idx_users_email`, `idx_users_role`.
- **RLS Policy:** Users can view their own record; Founder can view/manage all users.

### 7.2 Table: `outreach_seats`
- **Purpose:** Represents operational capacity slots assigned to users.
- **Columns:**
  - `id` (UUID, Primary Key, Default: `gen_random_uuid()`) — *Authoritative*
  - `seat_code` (VARCHAR(50), UNIQUE, NOT NULL) e.g., 'SEAT_ALPHA' — *Authoritative*
  - `display_name` (VARCHAR(100), NOT NULL) e.g., 'Outreach Seat A' — *Authoritative*
  - `current_user_id` (UUID, Foreign Key -> `users.id`, NULLABLE) — *Authoritative*
  - `daily_outreach_target` (INTEGER, Default: 30, NOT NULL) — *Authoritative*
  - `created_at` (TIMESTAMPTZ, Default: `now()`) — *System*
  - `updated_at` (TIMESTAMPTZ, Default: `now()`) — *System*
- **Indexes:** `idx_outreach_seats_user_id`.

### 7.3 Table: `leads`
- **Purpose:** Core business object representing real estate prospects.
- **Columns:**
  - `id` (UUID, Primary Key, Default: `gen_random_uuid()`) — *Authoritative*
  - `company_name` (VARCHAR(255), NOT NULL) — *User*
  - `contact_name` (VARCHAR(255), NULLABLE) — *User*
  - `title_role` (VARCHAR(150), NULLABLE) — *User*
  - `business_type` (VARCHAR(100), NULLABLE) e.g., 'Residential Developer' — *User/AI*
  - `location` (VARCHAR(150), NULLABLE) e.g., 'Abuja, Nigeria' — *User*
  - `description` (TEXT, NULLABLE) — *User*
  - `pipeline_stage` (VARCHAR(50), Default: 'UNCONTACTED', NOT NULL) — *Authoritative*
  - `status` (VARCHAR(50), Default: 'ACTIVE', NOT NULL) — *Authoritative*
  - `owner_user_id` (UUID, Foreign Key -> `users.id`, NOT NULL) — *Authoritative*
  - `created_by_user_id` (UUID, Foreign Key -> `users.id`, NOT NULL) — *Authoritative*
  - `last_contact_at` (TIMESTAMPTZ, NULLABLE) — *Derived/System*
  - `next_follow_up_at` (TIMESTAMPTZ, NULLABLE) — *Derived/AI*
  - `created_at` (TIMESTAMPTZ, Default: `now()`, NOT NULL) — *System*
  - `updated_at` (TIMESTAMPTZ, Default: `now()`, NOT NULL) — *System*
- **Indexes:** `idx_leads_owner_stage` (`owner_user_id`, `pipeline_stage`), `idx_leads_company` (`company_name`), `idx_leads_next_followup` (`next_follow_up_at`).

### 7.4 Table: `lead_contacts`
- **Purpose:** Normalized contact channels (Phone, WhatsApp, Email).
- **Columns:**
  - `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  - `lead_id` (UUID, Foreign Key -> `leads.id` ON DELETE CASCADE, NOT NULL)
  - `contact_type` (VARCHAR(30), NOT NULL) — `PHONE` | `WHATSAPP` | `EMAIL`
  - `raw_value` (VARCHAR(255), NOT NULL) — *User*
  - `normalized_value` (VARCHAR(255), NOT NULL) — e.g. `+2348012345678` — *Derived/System*
  - `is_primary` (BOOLEAN, Default: `true`, NOT NULL)
  - `created_at` (TIMESTAMPTZ, Default: `now()`)
- **Indexes:** `idx_contacts_normalized` (`contact_type`, `normalized_value`).
- **Unique Constraint:** `(contact_type, normalized_value)`.

### 7.5 Table: `lead_social_profiles`
- **Purpose:** Handles Instagram, Facebook, LinkedIn, Website, Domain endpoints.
- **Columns:**
  - `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  - `lead_id` (UUID, Foreign Key -> `leads.id` ON DELETE CASCADE, NOT NULL)
  - `platform` (VARCHAR(30), NOT NULL) — `INSTAGRAM` | `FACEBOOK` | `LINKEDIN` | `WEBSITE`
  - `handle_or_url` (TEXT, NOT NULL) — *User*
  - `normalized_identifier` (VARCHAR(255), NOT NULL) — e.g. `abcproperties_ng` or `abcproperties.com` — *System*
  - `created_at` (TIMESTAMPTZ, Default: `now()`)
- **Indexes:** `idx_social_normalized` (`platform`, `normalized_identifier`).

### 7.6 Table: `lead_evidence`
- **Purpose:** Structured evidence supporting AI observations and briefings.
- **Columns:**
  - `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  - `lead_id` (UUID, Foreign Key -> `leads.id` ON DELETE CASCADE, NOT NULL)
  - `source_type` (VARCHAR(50), NOT NULL) — `INSTAGRAM_BIO` | `WEBSITE_PAGE` | `POST_CAPTION` | `MANUAL_NOTE`
  - `evidence_text` (TEXT, NOT NULL) — *User/System*
  - `source_url` (TEXT, NULLABLE)
  - `category` (VARCHAR(50), NOT NULL) — `VERIFIED_FACT` | `REASONABLE_OBSERVATION`
  - `created_at` (TIMESTAMPTZ, Default: `now()`)
- **Indexes:** `idx_evidence_lead` (`lead_id`).

### 7.7 Table: `conversations`
- **Purpose:** Primary thread history for a prospect.
- **Columns:**
  - `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  - `lead_id` (UUID, Foreign Key -> `leads.id` ON DELETE CASCADE, UNIQUE, NOT NULL)
  - `channel` (VARCHAR(30), Default: 'WHATSAPP', NOT NULL)
  - `summary` (TEXT, NULLABLE) — *AI-Generated*
  - `last_message_at` (TIMESTAMPTZ, NULLABLE) — *System*
  - `created_at` (TIMESTAMPTZ, Default: `now()`)
  - `updated_at` (TIMESTAMPTZ, Default: `now()`)

### 7.8 Table: `messages`
- **Purpose:** First-class entity for every message draft, edit, and sent communication.
- **Columns:**
  - `id` (UUID, Primary Key, Default: `gen_random_uuid()`) — *Authoritative*
  - `conversation_id` (UUID, Foreign Key -> `conversations.id` ON DELETE CASCADE, NOT NULL) — *Authoritative*
  - `sender_user_id` (UUID, Foreign Key -> `users.id`, NULLABLE) — NULL if inbound — *Authoritative*
  - `direction` (VARCHAR(10), NOT NULL) — `OUTBOUND` | `INBOUND` — *Authoritative*
  - `type` (VARCHAR(50), NOT NULL) — `FIRST_TOUCH` | `FOLLOW_UP` | `RESPONSE` | `VALUE_MESSAGE` | `MANUAL` — *Authoritative*
  - `ai_generated_content` (TEXT, NULLABLE) — *AI-Generated*
  - `human_edited_content` (TEXT, NULLABLE) — *User-Generated*
  - `final_sent_content` (TEXT, NULLABLE) — *Authoritative*
  - `status` (VARCHAR(30), NOT NULL) — `GENERATED` | `EDITED` | `APPROVED` | `WHATSAPP_OPENED` | `SENT` | `FAILED` — *Authoritative*
  - `evidence_used` (JSONB, Default: '[]'::jsonb) — *AI-Generated*
  - `whatsapp_url_generated` (TEXT, NULLABLE) — *System*
  - `created_at` (TIMESTAMPTZ, Default: `now()`, NOT NULL)
  - `sent_at` (TIMESTAMPTZ, NULLABLE)
- **Indexes:** `idx_messages_conversation` (`conversation_id`, `created_at`).

### 7.9 Table: `message_edits`
- **Purpose:** Historical diff tracking between AI draft and final sent message for learning.
- **Columns:**
  - `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  - `message_id` (UUID, Foreign Key -> `messages.id` ON DELETE CASCADE, NOT NULL)
  - `user_id` (UUID, Foreign Key -> `users.id`, NOT NULL)
  - `original_ai_content` (TEXT, NOT NULL)
  - `edited_content` (TEXT, NOT NULL)
  - `edit_distance` (INTEGER, NOT NULL) — *System*
  - `created_at` (TIMESTAMPTZ, Default: `now()`)

### 7.10 Table: `activities_events`
- **Purpose:** Immutable audit event stream.
- **Columns:**
  - `id` (UUID, Primary Key, Default: `gen_random_uuid()`) — *Authoritative*
  - `event_type` (VARCHAR(100), NOT NULL) — e.g., `LEAD_CREATED`, `WHATSAPP_OPENED`, `MESSAGE_SENT`
  - `lead_id` (UUID, Foreign Key -> `leads.id` ON DELETE CASCADE, NULLABLE)
  - `actor_user_id` (UUID, Foreign Key -> `users.id`, NOT NULL)
  - `payload` (JSONB, Default: '{}'::jsonb, NOT NULL)
  - `created_at` (TIMESTAMPTZ, Default: `now()`, NOT NULL)
- **Indexes:** `idx_events_lead` (`lead_id`), `idx_events_actor` (`actor_user_id`, `created_at`).

### 7.11 Table: `follow_ups`
- **Purpose:** Scheduled follow-up items.
- **Columns:**
  - `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  - `lead_id` (UUID, Foreign Key -> `leads.id` ON DELETE CASCADE, NOT NULL)
  - `assigned_user_id` (UUID, Foreign Key -> `users.id`, NOT NULL)
  - `due_at` (TIMESTAMPTZ, NOT NULL)
  - `reason` (TEXT, NOT NULL) — *AI/User*
  - `status` (VARCHAR(30), Default: 'PENDING', NOT NULL) — `PENDING` | `COMPLETED` | `SKIPPED`
  - `completed_at` (TIMESTAMPTZ, NULLABLE)
  - `created_at` (TIMESTAMPTZ, Default: `now()`)

### 7.12 Table: `outcomes`
- **Purpose:** Recorded business results for sales intelligence.
- **Columns:**
  - `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  - `lead_id` (UUID, Foreign Key -> `leads.id` ON DELETE CASCADE, NOT NULL)
  - `recorded_by_user_id` (UUID, Foreign Key -> `users.id`, NOT NULL)
  - `outcome_type` (VARCHAR(50), NOT NULL) — e.g. `NO_RESPONSE`, `REPLIED_POSITIVE`, `MEETING_SCHEDULED`, `CLOSED_WON`
  - `notes` (TEXT, NULLABLE)
  - `created_at` (TIMESTAMPTZ, Default: `now()`)

### 7.13 Table: `learning_signals`
- **Purpose:** Raw learning data derived from outreach outcomes and edits.
- **Columns:**
  - `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  - `lead_id` (UUID, Foreign Key -> `leads.id`, NULLABLE)
  - `message_id` (UUID, Foreign Key -> `messages.id`, NULLABLE)
  - `signal_type` (VARCHAR(50), NOT NULL) — e.g. `HIGH_RESPONSE_HOOK`, `EDIT_PATTERN_REMOVE_FLUFF`
  - `feature_vector` (JSONB, NOT NULL)
  - `score_impact` (NUMERIC(5,2), Default: 0.0)
  - `created_at` (TIMESTAMPTZ, Default: `now()`)

### 7.14 Table: `learning_insights`
- **Purpose:** Synthesized institutional knowledge patterns for AI prompt context.
- **Columns:**
  - `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  - `category` (VARCHAR(100), NOT NULL) — e.g., 'ABUJA_RESIDENTIAL_HOOKS'
  - `insight_summary` (TEXT, NOT NULL)
  - `confidence_score` (NUMERIC(3,2), Default: 0.80)
  - `is_active` (BOOLEAN, Default: `true`)
  - `created_at` (TIMESTAMPTZ, Default: `now()`)

---

## 8. Authentication Architecture

- **Provider:** Supabase Auth using Email/Password or Magic Link.
- **JWT Handling:**
  - Frontend receives JWT access token upon successful auth.
  - JWT is stored in secure HttpOnly cookies or memory state (never in unencrypted localStorage as permission check authority).
  - Express server validates JWT on every request via `jsonwebtoken` / Supabase public key verification middleware.
- **Middleware Flow:**
  `Request -> Extract Bearer Token -> Verify JWT -> Fetch user from users table -> Attach req.user -> Next()`.

---

## 9. Authorization & RLS Architecture

### 9.1 Server-Side Role-Based Access Control (RBAC)
- **Founder Role (`FOUNDER`):** Full read/write across all user accounts, leads, analytics, settings, and team activities.
- **Specialist Role (`OUTREACH_SPECIALIST`):** Read/write access strictly restricted to:
  1. Leads where `owner_user_id == req.user.id`.
  2. Messages, conversations, activities, and follow-ups associated with owned leads.
  3. Execution dashboards (`Today's Focus`, `My Prospects`, `Performance`).

### 9.2 Supabase Row Level Security (RLS) Rules (Fallback & Direct DB Safety)
```sql
-- Leads Table Policy
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders have full access to all leads"
ON leads FOR ALL
TO authenticated
USING ( (SELECT role FROM users WHERE id = auth.uid()) = 'FOUNDER' );

CREATE POLICY "Specialists can view and edit their owned leads"
ON leads FOR ALL
TO authenticated
USING ( owner_user_id = auth.uid() );
```

---

## 10. User, Role, and Seat Architecture

- **User:** Physical person with login identity.
- **Seat:** Functional workstation in the outreach department (e.g., `Seat A`).
- **Dynamic Assignment:** Reassigning `Seat A` from User 1 to User 2 updates `outreach_seats.current_user_id`.
- **Historical Integrity:** All historical records in `messages`, `activities_events`, and `leads.created_by_user_id` remain explicitly linked to User 1's immutable UUID.

---

## 11. Lead Lifecycle

```
[UNCONTACTED] ──► [CONTACTED] ──► [REPLIED] ──► [QUALIFIED / MEETING] ──► [CLOSED_WON / LOST / NURTURE]
      │                 │             │
      └──► (Follow-Up Due) ───────────┘
```

Status transitions are validated server-side based on event triggers:
- First-touch message sent -> Moves `UNCONTACTED` to `CONTACTED`.
- Inbound reply recorded -> Moves `CONTACTED` to `REPLIED`.
- Outcome form submission -> Moves lead to `QUALIFIED`, `MEETING`, `CLOSED_WON`, or `NURTURE`.

---

## 12. Prospect Capture Workflow

1. Specialist fills capture form (Company Name, Contact Name, Phone, Social Handle, Website, Evidence Notes).
2. API executes `POST /api/v1/prospects/duplicate-check`.
3. If duplicate found -> UI blocks creation and displays duplicate reason and lead owner.
4. If clear -> API executes transactional `POST /api/v1/prospects/create`:
   - Inserts into `leads`, `lead_contacts`, `lead_social_profiles`, `lead_evidence`.
   - Auto-assigns `owner_user_id = authenticated_user.id`.
   - Emits `LEAD_CREATED` event.
   - Automatically invokes Central AI Engine to generate initial Prospect Briefing.

---

## 13. Duplicate Detection Architecture

- **Normalization Utility:**
  - Nigerian Phone Normalizer: Converts `08012345678`, `2348012345678`, `+234 80 1234 5678` into standardized `+2348012345678`.
  - Social Identifier Normalizer: Strips URLs, `@` symbols, trailing slashes to isolate root handle/domain.
- **Matching Matrix:**
  - **EXACT MATCH:** Equal `normalized_phone`, equal `normalized_whatsapp`, equal `email`, or equal `normalized_social_identifier`.
  - **POTENTIAL MATCH:** Equal normalized domain name, or high trigram similarity (>0.85) on `company_name`.
- **Response Format:**
  ```json
  {
    "matchType": "EXACT_MATCH",
    "matchedLead": { "id": "...", "companyName": "ABC Homes", "ownerName": "Alex" },
    "reason": "Normalized WhatsApp number +2348012345678 matches existing lead."
  }
  ```

---

## 14. Message Architecture

- Every outbound message is a first-class relational entity with an immutable lifecycle record.
- **Fields:**
  - `ai_generated_content`: Direct string from Gemini response.
  - `human_edited_content`: Form state string after specialist editing.
  - `final_sent_content`: Persisted string when marked as sent.
- **Types:** `FIRST_TOUCH`, `FOLLOW_UP`, `RESPONSE`, `VALUE_MESSAGE`, `MANUAL`.
- **Edit Tracking:** On send, if `human_edited_content` differs from `ai_generated_content`, an edit record is logged to `message_edits` with computed Levenshtein distance.

---

## 15. Conversation Architecture

- Each lead possesses exactly one primary `conversations` record.
- Conversation thread is fetched as an ordered timeline array combining `messages` (outbound & inbound) and `activities_events`.
- Conversation summary is updated asynchronously by the Central AI Engine after every 3 message turns.

---

## 16. WhatsApp Execution Architecture

- **Canonical Execution Service:**
  `WhatsAppService.buildTargetUrl(phoneNormalized: string, messageText: string): string`
  Produces: `https://api.whatsapp.com/send?phone=+2348012345678&text=EncodedMessage`
- **Execution Workflow:**
  1. Specialist clicks "Open WhatsApp".
  2. UI triggers `POST /api/v1/messages/:id/whatsapp-opened`.
  3. Server sets status to `WHATSAPP_OPENED`, stores timestamp, and emits `WHATSAPP_OPENED` event.
  4. UI launches WhatsApp in a new tab via `window.open()`.
  5. Prompt appears: "Did your message send successfully?" [Confirm Sent] / [Issue Encountered].
  6. Clicking [Confirm Sent] invokes `POST /api/v1/messages/:id/confirm-sent`, transitioning status to `SENT`.

---

## 17. Central Intelligence Architecture (DFQLABS AI Engine)

- **Single Service Entrypoint:** `AIEngineService` in backend.
- **Provider:** Google Gemini API (`@google/genai` or `@google/generative-ai`).
- **Capabilities:**
  - `generateBriefing(leadId)`
  - `generateFirstTouch(leadId)`
  - `generateFollowUp(leadId, conversationId)`
  - `interpretResponse(leadId, inboundMessage)`
  - `recommendNextAction(leadId)`
  - `extractLearningSignals(period)`

---

## 18. Sales Brain Architecture

- The Sales Brain is the core algorithmic component inside `AIEngineService`.
- Synthesizes prospect evidence, historical response patterns, and high-performing hooks.
- Operates statelessly: fetches DB state -> constructs prompt -> invokes Gemini -> validates schema -> returns response.

---

## 19. AI Coach Architecture

- Interface layer over `AIEngineService` accessible via UI drawer/modal.
- Provides context-aware answers to specialist queries like "How should I handle this price objection from XYZ Properties?".
- Injects prospect evidence and conversation history directly into prompt context.

---

## 20. Today's Focus Architecture

- Deterministic recommendation engine combining database urgency with AI priority.
- Query priority order:
  1. **Unreplied Inbound Messages:** Leads with unread replies from prospects (Highest Priority).
  2. **Overdue Follow-ups:** Leads where `next_follow_up_at <= NOW()`.
  3. **Uncontacted Leads:** Newly created leads assigned to user with no outbound messages.
- Returns max 30 actionable cards per day matching specialist target.

---

## 21. Mission Control Architecture

- High-level operational dashboard.
- **Specialist View:** Daily outreach progress bar (e.g., 18/30 completed), pending follow-ups count, active conversations count, weekly response rate.
- **Founder View:** Team-wide performance comparison, conversion bottleneck analysis, pipeline velocity, active seats status.

---

## 22. Learning Intelligence Architecture

- Operates as a background analytics and prompt enhancement system.
- Analyzes `message_edits` to detect phrases human specialists repeatedly remove (e.g., corporate jargon like "synergy") or add (e.g., localized greetings).
- Aggregates high-converting first-touch hooks into `learning_insights`.
- Automatically injects top 3 active `learning_insights` into system prompts for draft generation.

---

## 23. Event Architecture

- Every state change triggers an immutable entry in `activities_events`.
- **Supported Event Types:**
  - `LEAD_CREATED`
  - `LEAD_ASSIGNED`
  - `DUPLICATE_CHECKED`
  - `BRIEFING_GENERATED`
  - `MESSAGE_GENERATED`
  - `MESSAGE_EDITED`
  - `WHATSAPP_OPENED`
  - `MESSAGE_SENT`
  - `INBOUND_REPLY_RECORDED`
  - `FOLLOW_UP_SCHEDULED`
  - `OUTCOME_RECORDED`

---

## 24. Outcome Architecture

- Standardized taxonomy of sales outcomes:
  - `NO_RESPONSE`
  - `REPLIED_POSITIVE`
  - `REPLIED_NEGATIVE`
  - `AUDIT_REQUESTED`
  - `MEETING_SCHEDULED`
  - `PROPOSAL_SENT`
  - `CLOSED_WON`
  - `CLOSED_LOST`
- Recording an outcome updates `leads.pipeline_stage` and schedules or clears pending follow-ups automatically.

---

## 25. API Endpoint Inventory

| Method | Path | Purpose | Auth | Role | Input Payload | Output Payload | DB Effect | Events Created |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | User authentication | No | Any | `{email, password}` | `{token, user}` | None | None |
| GET | `/api/v1/auth/me` | Fetch active session | Yes | Any | None | `{user, seat}` | None | None |
| POST | `/api/v1/prospects/duplicate-check` | Check duplicate prospect | Yes | Any | `{phone, social, website, company}` | `{matchType, matchedLead, reason}` | None | `DUPLICATE_CHECKED` |
| POST | `/api/v1/prospects` | Create lead | Yes | Any | Lead JSON | Created Lead Object | Inserts `leads`, `contacts`, etc. | `LEAD_CREATED` |
| GET | `/api/v1/prospects` | List/search leads | Yes | Any | Query params (`page`, `search`, `stage`) | `{leads[], total}` | None | None |
| GET | `/api/v1/prospects/:id` | Fetch prospect detail | Yes | Any | Lead ID | Full Lead Detail + Briefing | None | None |
| POST | `/api/v1/prospects/:id/briefing` | Generate prospect briefing | Yes | Any | Lead ID | Briefing JSON | Inserts `lead_evidence` | `BRIEFING_GENERATED` |
| POST | `/api/v1/messages/generate-first-touch` | Generate DM | Yes | Any | `{leadId}` | Message Draft JSON | Inserts `messages` | `MESSAGE_GENERATED` |
| PUT | `/api/v1/messages/:id` | Save draft edits | Yes | Any | `{editedContent}` | Updated Message JSON | Updates `messages` | `MESSAGE_EDITED` |
| POST | `/api/v1/messages/:id/whatsapp-open` | Log WA open | Yes | Any | None | `{whatsappUrl}` | Updates `messages.status` | `WHATSAPP_OPENED` |
| POST | `/api/v1/messages/:id/confirm-sent` | Confirm message sent | Yes | Any | `{finalContent}` | Confirmed Message JSON | Updates `messages`, `leads` | `MESSAGE_SENT` |
| POST | `/api/v1/conversations/:id/inbound` | Log prospect reply | Yes | Any | `{content, sentAt}` | Message JSON | Inserts `messages` | `INBOUND_REPLY_RECORDED` |
| GET | `/api/v1/focus/today` | Fetch Today's Focus | Yes | Specialist | None | `{focusItems[]}` | None | None |
| GET | `/api/v1/dashboard/mission-control` | Dashboard metrics | Yes | Any | None | Metric Breakdown JSON | None | None |
| POST | `/api/v1/outcomes` | Record sales outcome | Yes | Any | `{leadId, outcomeType, notes}` | Outcome Object | Inserts `outcomes`, updates `leads` | `OUTCOME_RECORDED` |
| GET | `/api/v1/admin/team` | Team & Seats | Yes | Founder | None | `{users[], seats[]}` | None | None |
| POST | `/api/v1/admin/seats/reassign` | Reassign Seat | Yes | Founder | `{seatId, newUserId}` | Seat Object | Updates `outreach_seats` | `SEAT_REASSIGNED` |

---

## 26. API Authorization Matrix

| Endpoint | Founder | Outreach Specialist |
|---|---|---|
| `POST /api/v1/prospects` | Allowed (Can assign to anyone) | Allowed (Auto-assigned to self) |
| `GET /api/v1/prospects` | Access all leads across team | Access only owned leads |
| `GET /api/v1/prospects/:id` | Access any lead | Access only if owner |
| `POST /api/v1/messages/*` | Access any lead | Access only if owner |
| `GET /api/v1/admin/*` | Full Access | **403 Forbidden** |

---

## 27. AI Context Architecture

To maintain token efficiency and prevent hallucinations, AI prompts receive a tightly scoped, structured context object:

```json
{
  "prospect": {
    "companyName": "ABC Properties",
    "businessType": "Luxury Residential Developer",
    "location": "Abuja, Nigeria"
  },
  "verifiedEvidence": [
    "Instagram post on Oct 12 shows launch of Guzape luxury duplexes.",
    "Website lists 4 completed residential projects in Maitama."
  ],
  "recentConversationHistory": [
    { "direction": "OUTBOUND", "text": "Hi Sarah, noticed your new Guzape project..." },
    { "direction": "INBOUND", "text": "Thanks! We are currently looking for marketing partners." }
  ],
  "learnedInsights": [
    "Mentioning specific locations like Guzape increases response rates by 24%."
  ]
}
```

---

## 28. AI Grounding Strategy

- System prompts strictly instruct Gemini:
  1. "You are an expert sales intelligence assistant for DFQLABS."
  2. "You may ONLY cite facts provided in the `verifiedEvidence` block."
  3. "If a piece of information is missing, explicitly categorize it as `UNKNOWN`. Never invent project names, numbers, or client details."
- **Output Schema Validation:** Gemini outputs are constrained using structured JSON schemas (`response_schema`). Zod parses output; if schema validation fails, backend returns fallback generic template and flags error.

---

## 29. Error-Handling Strategy

- Unified error response schema:
  ```json
  {
    "error": {
      "code": "DUPLICATE_PROSPECT_FOUND",
      "message": "A prospect with normalized phone +2348012345678 already exists.",
      "details": { "existingLeadId": "123e4567-e89b-12d3-a456-426614174000" }
    }
  }
  ```
- Unhandled client exceptions gracefully capture form state into local IndexedDB before rendering an error boundary with a "Restore Form" button.

---

## 30. Testing Strategy

- **Unit Testing:** Vitest for utility functions (phone normalization, trigram similarity, Zod schema validation).
- **Integration Testing:** Supertest against local PostgreSQL container testing transactional API endpoints.
- **AI Boundary Testing:** Automated test suite verifying Gemini output schema compliance and anti-hallucination guardrails.
- **E2E Testing:** Playwright tests verifying key end-to-end flows (Login -> Today's Focus -> Open Lead -> Generate DM -> Confirm WhatsApp Send).

---

## 31. Security Strategy

- Secrets strictly passed via environment variables (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `JWT_SECRET`).
- Zero service-role keys exposed to client frontend.
- API Rate Limiting: Express `express-rate-limit` restricting sensitive endpoints (e.g. AI generation limited to 30 requests/min per user).
- SQL Injection protection via Supabase parameterized query interface / Prisma ORM.

---

## 32. Performance Strategy

- Server-side pagination (`limit=25`, `cursor` based) for prospect lists.
- Database indexes on query filter columns (`owner_user_id`, `pipeline_stage`, `created_at`).
- Lazy loading for UI detail tabs (Evidence, Conversation Timeline, Activity Log).
- Connection pooling managed via Supabase PgBouncer.

---

## 33. Migration Strategy (from OS1 to OS2)

1. OS1 production database remains 100% read-only and untouched.
2. Migration Script (`scripts/migrate-os1-data.ts`) connects to OS1 DB in read-only mode.
3. Maps JSONB fields from OS1 into OS2 normalized schema:
   - Extract raw phone/whatsapp -> run through Phone Normalizer -> insert into `lead_contacts`.
   - Map historical user names to newly generated OS2 User IDs.
4. Duplicate check against existing OS2 database prior to insertion.
5. Produces Migration Execution Audit Log (`migration_report.json`).

---

## 34. Deployment Architecture

- **Frontend:** Deployed to Vercel or Netlify with SPA routing fallback.
- **Backend API:** Deployed as Node.js container on Render / Railway / AWS ECS.
- **Database:** Supabase PostgreSQL (Project B).
- Environment configurations managed via secure secret store.

---

## 35. Observability Strategy

- Structured JSON logging using `pino` logger.
- Log Levels: `INFO` (audit events), `WARN` (duplicate attempts, retries), `ERROR` (AI failures, DB transaction rollbacks).
- Healthcheck endpoint: `GET /health` returning DB connectivity and Gemini API response status.

---

## 36. Phased Implementation Plan

- **Phase 0:** Architecture Blueprint & Final Approvals (Current Phase).
- **Phase 1:** Repository Setup, Supabase Project Initializing & Migration Scripts Baseline.
- **Phase 2:** Authentication, User & Seat Models, Server-Side Authorization Middleware.
- **Phase 3:** Lead Data Model, Prospect Capture Workflow, Phone Normalizer & Duplicate Engine.
- **Phase 4:** Lead Intelligence Services, Search & Prospect Directory UI.
- **Phase 5:** Message Data Model, Conversation Memory & Edit Tracking.
- **Phase 6:** Canonical WhatsApp Execution Service & Confirm-Sent Workflow.
- **Phase 7:** Central Intelligence Engine (Gemini Integration, Briefing & First-Touch Generation).
- **Phase 8:** Today's Focus Engine & Mission Control Operational Dashboards.
- **Phase 9:** Learning Intelligence Engine (Edit Distance Tracking & Insight Extractor).
- **Phase 10:** Founder Command Center, Seat Management & Team Analytics.
- **Phase 11:** OS1 Controlled Data Migration Tooling & Testing.
- **Phase 12:** Production Hardening, E2E Testing & Go-Live.

---

## 37. Acceptance Criteria

A feature is strictly defined as **COMPLETE** when:
1. Code is fully typed without `any` overrides.
2. Database operations execute atomically within transactions.
3. Server enforces RBAC authorization check.
4. Corresponding audit event is logged to `activities_events`.
5. Automated integration test passes.
6. Frontend handles loading, empty, and error states gracefully with dark theme tokens.

---

## 38. Risks & Mitigations

| Identified Risk | Severity | Technical Mitigation |
|---|---|---|
| AI Hallucinations in outreach | High | Enforce strict evidence context schema & fallback system prompts. |
| Stale frontend overwriting DB | Medium | Use server-authoritative timestamps & explicit state refresh on API return. |
| WhatsApp popup blocked by browser | Medium | Trigger `window.open` synchronously on click user event before async confirmation call. |
| OS1 migration corrupted data | High | Run dry-run migration script in staging DB with strict schema validation. |

---

## 39. Recommended Folder Structure

```
dfqlabs-os2/
├── .env.example
├── README.md
├── ARCHITECTURE.md
├── package.json
├── tsconfig.json
├── src/
│   ├── client/                  # React Frontend (Vite)
│   │   ├── src/
│   │   │   ├── assets/
│   │   │   ├── components/      # UI Design System Components
│   │   │   ├── context/         # Auth & Session Context
│   │   │   ├── hooks/           # Custom React Query Hooks
│   │   │   ├── pages/           # Screen Pages (Founder & Specialist)
│   │   │   ├── services/        # API Client Services
│   │   │   ├── types/           # Shared Frontend Types
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   ├── server/                  # Express Backend API
│   │   ├── src/
│   │   │   ├── config/          # Env & Supabase client config
│   │   │   ├── controllers/     # REST Route Controllers
│   │   │   ├── middleware/      # Auth, RBAC, Validation & Error Middleware
│   │   │   ├── routes/          # Express Routers
│   │   │   ├── services/        # Core Business Logic (AI, Duplicate, WA, Lead)
│   │   │   ├── utils/           # Phone normalizers, trigram, loggers
│   │   │   └── app.ts
│   ├── shared/                  # Shared Types & Zod Schemas
│   └── db/                      # Supabase SQL Migrations & Seeds
│       ├── migrations/
│       └── seeds/
└── tests/                       # Unit, Integration & E2E Tests
```

---

## 40. Recommended Dependency List

### Backend Core
- `express`: Lightweight HTTP server framework.
- `@supabase/supabase-js`: Official Supabase client for database & auth.
- `@google/genai`: Official Google Gemini SDK.
- `zod`: TypeScript-first schema declaration and validation.
- `jsonwebtoken`: Secure JWT verification.
- `pino`: Ultra-fast, low-overhead JSON logger.

### Frontend Core
- `react`, `react-dom`: UI framework.
- `@tanstack/react-query`: Async state management & server caching.
- `react-router-dom`: SPA routing.
- `lucide-react`: Clean, modern icon library.
- `tailwindcss`, `autoprefixer`: Utility-first CSS styling framework.

### Development & Testing
- `typescript`: Type safety.
- `vitest`: Fast unit testing framework.
- `supertest`: HTTP assertion library for API testing.
- `playwright`: End-to-end browser verification.

---

## 68. Detailed UI Design & Screen Specifications

### 68.1 Outreach Specialist Screens

#### 1. Today's Focus (`/focus`)
- **Purpose:** Primary execution hub. Tells specialist exactly who to contact or follow up with today without decision fatigue.
- **Primary Action:** Click "Execute Action" on top focus card.
- **Data Required:** Prioritized focus items list from `GET /api/v1/focus/today`.
- **API Calls:** `GET /api/v1/focus/today`, `POST /api/v1/messages/generate-first-touch`.
- **Permissions:** `OUTREACH_SPECIALIST`, `FOUNDER`.
- **Empty State:** "🎉 All caught up for today! No pending outreach actions or overdue follow-ups."
- **Loading State:** Glacier Blue glowing skeleton cards.
- **Error State:** Error banner with "Retry Loading Focus" button.

#### 2. My Prospects (`/prospects`)
- **Purpose:** View and search owned prospects.
- **Primary Action:** Filter by pipeline stage or search by name.
- **Data Required:** Paginated prospects list from `GET /api/v1/prospects?owner=me`.
- **API Calls:** `GET /api/v1/prospects`.
- **Permissions:** `OUTREACH_SPECIALIST`, `FOUNDER`.

#### 3. Add Prospect (`/prospects/new`)
- **Purpose:** Fast capture modal/page for new leads discovered on social media.
- **Primary Action:** Submit prospect details to execute duplicate check and creation.
- **Data Required:** Form fields (Company, Contact, Phone, Instagram, Website, Notes).
- **API Calls:** `POST /api/v1/prospects/duplicate-check`, `POST /api/v1/prospects`.
- **Permissions:** `OUTREACH_SPECIALIST`, `FOUNDER`.

#### 4. Conversations (`/conversations`)
- **Purpose:** Active dialogue management and message editing drawer.
- **Primary Action:** Edit AI message draft & open WhatsApp.
- **Data Required:** Conversation timeline, message drafts, evidence briefing.
- **API Calls:** `GET /api/v1/prospects/:id`, `PUT /api/v1/messages/:id`, `POST /api/v1/messages/:id/whatsapp-open`, `POST /api/v1/messages/:id/confirm-sent`.

#### 5. Specialist Performance (`/performance`)
- **Purpose:** Specialist personal metric tracker against daily outreach target.
- **Primary Action:** View daily target progress bar (e.g. 22/30 completed).

---

### 68.2 Founder Screens

#### 1. Founder Command Center (`/admin/dashboard`)
- **Purpose:** Executive oversight over team performance, pipeline velocity, and conversion rate.
- **Primary Action:** View team-wide metrics and pipeline breakdown.
- **Data Required:** Aggregate stats from `GET /api/v1/dashboard/mission-control`.
- **Permissions:** `FOUNDER` strictly.

#### 2. Team & Seats (`/admin/team`)
- **Purpose:** Manage team members, roles, and outreach seats.
- **Primary Action:** Reassign user to outreach seat or deactivate user.
- **API Calls:** `GET /api/v1/admin/team`, `POST /api/v1/admin/seats/reassign`.
- **Permissions:** `FOUNDER` strictly.

#### 3. Learning Intelligence (`/admin/intelligence`)
- **Purpose:** Review extracted institutional knowledge, top-performing hooks, and human edit patterns.
- **Primary Action:** Activate or deactivate prompt insights.
- **Permissions:** `FOUNDER` strictly.

---

## 72. End-to-End Scenario Walkthrough: "ABC Properties"

The following walkthrough demonstrates how DFQLABS OS 2.0 executes the scenario step-by-step from discovery to learning extraction:

1. **Discovery & Capture:**
   Specialist Blessing discovers "ABC Properties" on Instagram. She navigates to `/prospects/new` in OS 2.0 and enters:
   - Company: "ABC Properties"
   - Instagram: "@abcproperties_ng"
   - Phone: "08012345678"
   - Website: "abcproperties.com"

2. **Duplicate Check Execution:**
   - Client sends `POST /api/v1/prospects/duplicate-check` with payload.
   - Server passes `08012345678` through Phone Normalizer (`+2348012345678`) and `@abcproperties_ng` through Social Normalizer (`abcproperties_ng`).
   - Server executes SQL query against `lead_contacts` and `lead_social_profiles`.
   - Result: `NO_MATCH`.

3. **Lead Creation & Auto-Assignment:**
   - Client sends `POST /api/v1/prospects`.
   - Server opens PostgreSQL transaction:
     - Inserts into `leads` (`company_name` = 'ABC Properties', `owner_user_id` = Blessing's UUID, `pipeline_stage` = 'UNCONTACTED').
     - Inserts normalized contact into `lead_contacts` (`contact_type` = 'WHATSAPP', `normalized_value` = '+2348012345678').
     - Inserts social profiles into `lead_social_profiles`.
     - Inserts immutable event into `activities_events` (`event_type` = 'LEAD_CREATED').
   - Transaction commits.

4. **Prospect Briefing & DM Generation:**
   - Server invokes `AIEngineService.generateFirstTouch(leadId)`.
   - AI Engine fetches lead details and active `learning_insights`.
   - Gemini returns structured JSON containing prospect briefing and first-touch message draft:
     *"Hi Sarah, noticed ABC Properties' recent update on your Guzape residential developments. Your focus on high-end finishing is clear..."*
   - Draft saved to `messages` with status `GENERATED`.

5. **Review & Human Editing:**
   - Blessing reviews draft in OS 2.0 UI.
   - She refines sentence 2 to highlight a specific project name: *"Hi Sarah, noticed ABC Properties' recent update on your Guzape luxury duplexes..."*
   - Client calls `PUT /api/v1/messages/:id` with edited content. Server updates `messages.human_edited_content` and sets status to `EDITED`.

6. **WhatsApp Launch & Confirm Send:**
   - Blessing clicks "Open WhatsApp".
   - Client calls `POST /api/v1/messages/:id/whatsapp-open`.
   - Server updates status to `WHATSAPP_OPENED` and generates canonical URL: `https://api.whatsapp.com/send?phone=+2348012345678&text=...`
   - UI launches WhatsApp in a new tab.
   - Blessing sends message in WhatsApp and returns to OS 2.0 UI, clicking "Confirm Sent".
   - Client calls `POST /api/v1/messages/:id/confirm-sent`.
   - Server updates `messages.status` = 'SENT', `final_sent_content` = edited string, `sent_at` = NOW(), updates `leads.pipeline_stage` = 'CONTACTED', logs `MESSAGE_SENT` event, and records diff into `message_edits`.

7. **Inbound Reply & AI Next Action:**
   - Two days later, prospect replies on WhatsApp: *"Thanks for reaching out! We are currently looking for video production partners for our Guzape launch."*
   - Blessing enters reply in OS 2.0 via `POST /api/v1/conversations/:id/inbound`.
   - Server logs inbound message, updates lead status to `REPLIED`.
   - Central AI Engine interprets response and highlights `RECOMMENDED_ACTION`: *"Schedule Audit Call / Offer Case Study"*.
   - Lead automatically surfaces at top of Blessing's **Today's Focus**.

8. **Outcome & Institutional Learning:**
   - After a follow-up conversation, Blessing schedules a meeting and records outcome: `MEETING_SCHEDULED`.
   - Server inserts record into `outcomes` and logs event.
   - Asynchronous Learning Engine analyzes successful sequence (`Guzape project hook` -> `Positive Reply` -> `Meeting Scheduled`).
   - Signal extracted: High positive correlation for localized project name hooks in Abuja residential segment.
   - Signal added to `learning_signals` to inform future outreach prompts across DFQLABS team.

---

*Blueprint finalized and submitted for review prior to implementation phase initiation.*
