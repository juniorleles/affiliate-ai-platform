-- Módulo: affiliate-ops (herdado do MVP anterior, agora em Postgres)

CREATE TABLE IF NOT EXISTS affiliates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',      -- active | paused | blocked
  commission_type TEXT,                       -- percentage | flat (NULL = usa padrão global)
  commission_value NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clicks (
  id BIGSERIAL PRIMARY KEY,
  affiliate_id INTEGER NOT NULL REFERENCES affiliates(id),
  destination TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  gclid TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversions (
  id BIGSERIAL PRIMARY KEY,
  affiliate_id INTEGER NOT NULL REFERENCES affiliates(id),
  click_id BIGINT REFERENCES clicks(id),
  order_ref TEXT,
  value NUMERIC(12,2) NOT NULL,
  commission NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',     -- pending | approved | paid | rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clicks_affiliate ON clicks(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_clicks_utm_campaign ON clicks(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_conversions_affiliate ON conversions(affiliate_id);

-- Usuários da plataforma (admin/equipe) — substitui a ADMIN_KEY simples do MVP
-- quando o acesso deixar de ser single-user (ver docs/ARQUITETURA.md seção 9)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
