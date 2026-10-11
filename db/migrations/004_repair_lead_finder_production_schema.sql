-- DFQLABS OS 2.0 — repair Lead Finder production schema
-- Idempotent forward repair for environments where 003 was only partially applied
-- or PostgREST's schema cache was not refreshed.
-- Safe to re-run; does not drop or rewrite existing lead data.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS discovery_score INTEGER CHECK (discovery_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS discovery_quality VARCHAR(30),
  ADD COLUMN IF NOT EXISTS discovery_source VARCHAR(100),
  ADD COLUMN IF NOT EXISTS discovery_run_id UUID,
  ADD COLUMN IF NOT EXISTS outreach_ready BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discovery_provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS discovery_place_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS identity_confidence INTEGER CHECK (identity_confidence BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS identity_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discovery_evidence JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_leads_discovery_score ON public.leads(discovery_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_outreach_ready ON public.leads(outreach_ready, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_discovery_run ON public.leads(discovery_run_id);

-- Make PostgREST re-read the updated database schema immediately.
NOTIFY pgrst, 'reload schema';
