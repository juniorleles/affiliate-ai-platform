-- Módulo: monitoring

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,                  -- campaign_paused | ad_disapproved | impression_drop | billing_issue | other
  severity TEXT NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  subject_type TEXT NOT NULL,          -- 'campaign' | 'account' | outros
  subject_id INTEGER,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open | ack | resolved
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status, created_at DESC);
