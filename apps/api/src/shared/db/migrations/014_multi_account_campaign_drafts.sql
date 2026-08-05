-- Fase 6/7 (2026-08-05): suporte a múltiplas contas do Google Ads + rascunhos de
-- campanha. google_ads_accounts já existia (migration 002) mas nunca foi usada de
-- verdade pra mais de 1 conta — completando isso agora.

ALTER TABLE google_ads_accounts
  ADD COLUMN login_customer_id TEXT, -- MCC, se essa conta for acessada via gerenciadora
  ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active'; -- active | suspended | unknown

-- Rascunho de campanha (Fase 6). NUNCA cria campanha real sozinho — status só
-- avança pra 'created_in_google_ads' depois de aprovação explícita do usuário.
CREATE TABLE IF NOT EXISTS campaign_drafts (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  google_ads_account_id INTEGER REFERENCES google_ads_accounts(id),
  name TEXT NOT NULL,
  daily_budget NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]',      -- [{text, matchType}]
  final_url TEXT,
  headlines JSONB,                            -- sugestões de headline da IA
  descriptions JSONB,                         -- sugestões de descrição da IA
  ai_copy_reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'draft',       -- draft | approved | created_in_google_ads | failed
  google_campaign_id TEXT,
  google_ad_group_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  created_in_google_ads_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaign_drafts_status ON campaign_drafts(status, created_at DESC);
