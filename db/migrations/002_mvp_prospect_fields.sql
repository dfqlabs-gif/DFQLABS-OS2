ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_type VARCHAR(80);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(100);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS service_tier VARCHAR(80);
CREATE INDEX IF NOT EXISTS idx_leads_client_type ON leads(client_type);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
