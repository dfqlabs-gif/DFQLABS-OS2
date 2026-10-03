-- DFQLABS OS 2.0 Database Migration Schema
-- Version 1.0 - 14 Normalized Tables with RLS, Constraints, and Indexes

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Table: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('FOUNDER', 'OUTREACH_SPECIALIST')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Table: outreach_seats
CREATE TABLE IF NOT EXISTS outreach_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seat_code VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    current_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    daily_outreach_target INTEGER NOT NULL DEFAULT 30 CHECK (daily_outreach_target > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_seats_user_id ON outreach_seats(current_user_id);

-- 3. Table: leads
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    title_role VARCHAR(150),
    business_type VARCHAR(100),
    location VARCHAR(150),
    description TEXT,
    pipeline_stage VARCHAR(50) NOT NULL DEFAULT 'UNCONTACTED' CHECK (pipeline_stage IN ('UNCONTACTED', 'CONTACTED', 'REPLIED', 'QUALIFIED', 'MEETING_SCHEDULED', 'PROPOSAL_SENT', 'CLOSED_WON', 'CLOSED_LOST', 'NURTURE')),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    last_contact_at TIMESTAMPTZ,
    next_follow_up_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_owner_stage ON leads(owner_user_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_name);
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_follow_up_at);

-- 4. Table: lead_contacts
CREATE TABLE IF NOT EXISTS lead_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    contact_type VARCHAR(30) NOT NULL CHECK (contact_type IN ('PHONE', 'WHATSAPP', 'EMAIL')),
    raw_value VARCHAR(255) NOT NULL,
    normalized_value VARCHAR(255) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_contact_type_normalized UNIQUE (contact_type, normalized_value)
);

CREATE INDEX IF NOT EXISTS idx_contacts_normalized ON lead_contacts(contact_type, normalized_value);

-- 5. Table: lead_social_profiles
CREATE TABLE IF NOT EXISTS lead_social_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    platform VARCHAR(30) NOT NULL CHECK (platform IN ('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'WEBSITE')),
    handle_or_url TEXT NOT NULL,
    normalized_identifier VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_normalized ON lead_social_profiles(platform, normalized_identifier);

-- 6. Table: lead_evidence
CREATE TABLE IF NOT EXISTS lead_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('INSTAGRAM_BIO', 'WEBSITE_PAGE', 'POST_CAPTION', 'MANUAL_NOTE')),
    evidence_text TEXT NOT NULL,
    source_url TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('VERIFIED_FACT', 'REASONABLE_OBSERVATION')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_lead ON lead_evidence(lead_id);

-- 7. Table: conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID UNIQUE NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    channel VARCHAR(30) NOT NULL DEFAULT 'WHATSAPP' CHECK (channel IN ('WHATSAPP', 'EMAIL', 'INSTAGRAM_DM')),
    summary TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Table: messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('OUTBOUND', 'INBOUND')),
    type VARCHAR(50) NOT NULL CHECK (type IN ('FIRST_TOUCH', 'FOLLOW_UP', 'RESPONSE', 'VALUE_MESSAGE', 'MANUAL')),
    ai_generated_content TEXT,
    human_edited_content TEXT,
    final_sent_content TEXT,
    status VARCHAR(30) NOT NULL CHECK (status IN ('GENERATED', 'EDITED', 'APPROVED', 'WHATSAPP_OPENED', 'SENT', 'FAILED')),
    evidence_used JSONB NOT NULL DEFAULT '[]'::jsonb,
    whatsapp_url_generated TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

-- 9. Table: message_edits
CREATE TABLE IF NOT EXISTS message_edits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    original_ai_content TEXT NOT NULL,
    edited_content TEXT NOT NULL,
    edit_distance INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Table: activities_events
CREATE TABLE IF NOT EXISTS activities_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL CHECK (event_type IN ('LEAD_CREATED', 'LEAD_ASSIGNED', 'DUPLICATE_CHECKED', 'BRIEFING_GENERATED', 'MESSAGE_GENERATED', 'MESSAGE_EDITED', 'WHATSAPP_OPENED', 'MESSAGE_SENT', 'INBOUND_REPLY_RECORDED', 'FOLLOW_UP_SCHEDULED', 'OUTCOME_RECORDED', 'SEAT_REASSIGNED')),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_lead ON activities_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_events_actor ON activities_events(actor_user_id, created_at);

-- 11. Table: follow_ups
CREATE TABLE IF NOT EXISTS follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    assigned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    due_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'SKIPPED')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Table: outcomes
CREATE TABLE IF NOT EXISTS outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    recorded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    outcome_type VARCHAR(50) NOT NULL CHECK (outcome_type IN ('NO_RESPONSE', 'REPLIED_POSITIVE', 'REPLIED_NEGATIVE', 'AUDIT_REQUESTED', 'MEETING_SCHEDULED', 'PROPOSAL_SENT', 'CLOSED_WON', 'CLOSED_LOST', 'NURTURE')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Table: learning_signals
CREATE TABLE IF NOT EXISTS learning_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    signal_type VARCHAR(50) NOT NULL CHECK (signal_type IN ('HIGH_RESPONSE_HOOK', 'EDIT_PATTERN_REMOVE_FLUFF', 'OBJECTION_HANDLED', 'TIMING_OPTIMAL')),
    feature_vector JSONB NOT NULL,
    score_impact NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. Table: learning_insights
CREATE TABLE IF NOT EXISTS learning_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    insight_summary TEXT NOT NULL,
    confidence_score NUMERIC(3,2) NOT NULL DEFAULT 0.80 CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security Setup
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Leads
CREATE POLICY "Founders have full access to all leads"
ON leads FOR ALL TO authenticated
USING ( (SELECT role FROM users WHERE id = auth.uid()) = 'FOUNDER' );

CREATE POLICY "Specialists can view and edit their owned leads"
ON leads FOR ALL TO authenticated
USING ( owner_user_id = auth.uid() );
