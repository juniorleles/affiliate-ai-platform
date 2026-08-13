-- Módulo de Contingência "guarda-chuva" (2026-08-05, pedido do usuário).
-- Escopo calibrado pra escala real informada: dezenas de contas (10-30), MCC já
-- existente com pelo menos 1 sub-conta — NÃO é a versão "centenas de contas,
-- automação de criação em massa" do texto original, que seria over-engineering
-- pro estágio atual do projeto.
--
-- Princípio seguido (mesmo do resto do projeto): isso é GOVERNANÇA e
-- VISIBILIDADE de uma estrutura multi-conta legítima — nunca criação de conta
-- pra burlar suspensão, nunca automação de bypass de política. O texto que o
-- usuário trouxe já é explícito sobre isso, e o projeto segue a mesma linha.

CREATE TABLE IF NOT EXISTS google_mccs (
  id SERIAL PRIMARY KEY,
  mcc_customer_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_mcc_id INTEGER REFERENCES google_mccs(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE google_ads_accounts
  ADD COLUMN mcc_id INTEGER REFERENCES google_mccs(id),
  ADD COLUMN operacao TEXT,
  ADD COLUMN marca TEXT,
  ADD COLUMN regiao TEXT,
  ADD COLUMN dominio TEXT,
  ADD COLUMN payment_method_label TEXT,
  ADD COLUMN daily_budget_cap NUMERIC(12,2),
  ADD COLUMN last_status_check_at TIMESTAMPTZ,
  ADD COLUMN previous_status TEXT;

CREATE INDEX IF NOT EXISTS idx_google_ads_accounts_mcc ON google_ads_accounts(mcc_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_accounts_payment ON google_ads_accounts(payment_method_label);
