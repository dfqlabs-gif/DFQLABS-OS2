-- DFQLABS OS 2.0 — Lead Intelligence / Daily Prospecting
-- Adds durable daily prospecting state without replacing the canonical leads table.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS discovery_score INTEGER CHECK (discovery_score BETWEEN 0 AND 100);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS discovery_quality VARCHAR(30);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS discovery_source VARCHAR(100);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS discovery_run_id UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS outreach_ready BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_discovery_score ON leads(discovery_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_outreach_ready ON leads(outreach_ready, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_discovery_run ON leads(discovery_run_id);

CREATE TABLE IF NOT EXISTS lead_finder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_target INTEGER NOT NULL DEFAULT 30 CHECK (daily_target > 0),
  minimum_score INTEGER NOT NULL DEFAULT 70 CHECK (minimum_score BETWEEN 0 AND 100),
  locations JSONB NOT NULL DEFAULT '["Abuja","Kano","Kaduna","Jos","Asaba","Benin City","Akwa Ibom"]'::jsonb,
  industries JSONB NOT NULL DEFAULT '["real estate developer","luxury realtor","real estate agency","property investment company"]'::jsonb,
  preferred_contact VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_finder_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL,
  target INTEGER NOT NULL,
  minimum_score INTEGER NOT NULL,
  requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING','COMPLETED','PARTIAL','FAILED')),
  found_count INTEGER NOT NULL DEFAULT 0,
  qualified_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  insufficient_count INTEGER NOT NULL DEFAULT 0,
  provider_queries INTEGER NOT NULL DEFAULT 0,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lead_finder_runs_date ON lead_finder_runs(run_date DESC, created_at DESC);
