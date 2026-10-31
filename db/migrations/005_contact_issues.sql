CREATE TABLE IF NOT EXISTS lead_contact_issues (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
 reported_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 issue_type VARCHAR(30) NOT NULL CHECK(issue_type IN ('NO_PHONE','NOT_ON_WHATSAPP')),
 status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','RESOLVED')),
 notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ,
 resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL, resolution_notes TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_contact_issue_per_lead ON lead_contact_issues(lead_id) WHERE status='OPEN';
CREATE INDEX IF NOT EXISTS idx_contact_issues_status_created ON lead_contact_issues(status,created_at DESC);
ALTER TABLE lead_contact_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders can manage contact issues" ON lead_contact_issues FOR ALL TO authenticated
 USING ((SELECT role FROM users WHERE id=auth.uid())='FOUNDER') WITH CHECK ((SELECT role FROM users WHERE id=auth.uid())='FOUNDER');
CREATE POLICY "Specialists can report and view own contact issues" ON lead_contact_issues FOR ALL TO authenticated
 USING (reported_by_user_id=auth.uid()) WITH CHECK (reported_by_user_id=auth.uid());
