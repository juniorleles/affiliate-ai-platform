-- Módulo: google-ads (evolução do que já existia no MVP anterior)

CREATE TABLE IF NOT EXISTS google_ads_accounts (
  id SERIAL PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  google_campaign_id TEXT NOT NULL UNIQUE,
  google_ads_account_id INTEGER REFERENCES google_ads_accounts(id),
  product_id INTEGER,                          -- FK lógica para products (módulo discovery), sem
                                                 -- constraint física ainda porque discovery só
                                                 -- chega na Fase 2 (ver docs/ARQUITETURA.md)
  name TEXT NOT NULL,
  status TEXT,
  channel_type TEXT,
  target_cpa NUMERIC(12,2),
  target_roas NUMERIC(8,2),
  last_synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS campaign_metrics_daily (
  id BIGSERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost NUMERIC(12,2) DEFAULT 0,
  google_conversions NUMERIC(12,2) DEFAULT 0,
  google_conversions_value NUMERIC(12,2) DEFAULT 0,
  UNIQUE(campaign_id, date)
);

CREATE TABLE IF NOT EXISTS keywords (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  text TEXT NOT NULL,
  match_type TEXT,
  is_negative BOOLEAN NOT NULL DEFAULT false,
  quality_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_campaign_date ON campaign_metrics_daily(campaign_id, date);
CREATE INDEX IF NOT EXISTS idx_keywords_campaign ON keywords(campaign_id);
