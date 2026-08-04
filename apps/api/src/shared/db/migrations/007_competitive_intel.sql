-- Módulo: competitive-intel (schema pronto, ingestão depende da decisão de fonte de dado —
-- ver docs/ARQUITETURA.md seção 9, item 1)

CREATE TABLE IF NOT EXISTS competitors (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),   -- nullable: concorrente pode anunciar vários produtos
  name TEXT NOT NULL,
  domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitor_ads (
  id BIGSERIAL PRIMARY KEY,
  competitor_id INTEGER NOT NULL REFERENCES competitors(id),
  product_id INTEGER REFERENCES products(id),
  platform TEXT,
  headline TEXT,
  body TEXT,
  creative_url TEXT,
  landing_page_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitor_ad_snapshots (
  id BIGSERIAL PRIMARY KEY,
  competitor_ad_id BIGINT NOT NULL REFERENCES competitor_ads(id),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_competitor_ads_product ON competitor_ads(product_id);
CREATE INDEX IF NOT EXISTS idx_competitor_ad_snapshots_ad ON competitor_ad_snapshots(competitor_ad_id, captured_at DESC);
