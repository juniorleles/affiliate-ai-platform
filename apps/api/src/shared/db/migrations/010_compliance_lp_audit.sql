-- Compliance do produtor (5.3) e Auditoria de LP (5.4) — docs/ARQUITETURA.md seção 5.3/5.4

CREATE TABLE IF NOT EXISTS producer_compliance (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  allows_brand_bidding BOOLEAN,
  allows_bottom_funnel BOOLEAN,
  requires_presell BOOLEAN,
  niche_sensitivity TEXT,          -- normal | sensitive | black (vem da IA)
  compliance_notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual', -- manual | network_api | ai_inferred
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS landing_page_audits (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  audited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  has_cta BOOLEAN,
  has_vsl BOOLEAN,
  load_time_ms INTEGER,
  offer_clarity_score INTEGER,
  affiliate_params_preserved BOOLEAN,
  raw_findings JSONB
);

CREATE INDEX IF NOT EXISTS idx_producer_compliance_product ON producer_compliance(product_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_page_audits_product ON landing_page_audits(product_id, audited_at DESC);
