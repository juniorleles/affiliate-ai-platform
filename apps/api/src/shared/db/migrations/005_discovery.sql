-- Módulo: discovery (schema definido agora, implementação de ingestão entra na Fase 2 —
-- ver docs/ARQUITETURA.md seção 8)

CREATE TABLE IF NOT EXISTS networks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                  -- digistore24 | clickbank | cj | impact | awin | partnerstack
  credentials_ref TEXT,                -- referência à credencial (nunca a chave em texto puro — seção 7)
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  network_id INTEGER NOT NULL REFERENCES networks(id),
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  price NUMERIC(12,2),
  commission_type TEXT,                -- percentage | flat
  commission_value NUMERIC(12,2),
  epc NUMERIC(12,4),
  conversion_rate NUMERIC(6,4),
  countries_allowed JSONB,
  sales_page_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(network_id, external_id)
);

CREATE TABLE IF NOT EXISTS product_snapshots (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  price NUMERIC(12,2),
  commission_value NUMERIC(12,2),
  epc NUMERIC(12,4),
  conversion_rate NUMERIC(6,4)
);

CREATE INDEX IF NOT EXISTS idx_products_network ON products(network_id);
CREATE INDEX IF NOT EXISTS idx_product_snapshots_product ON product_snapshots(product_id, captured_at DESC);

-- Liga a FK lógica de campaigns.product_id criada na migration 002 agora que products existe
ALTER TABLE campaigns
  ADD CONSTRAINT fk_campaigns_product FOREIGN KEY (product_id) REFERENCES products(id);
