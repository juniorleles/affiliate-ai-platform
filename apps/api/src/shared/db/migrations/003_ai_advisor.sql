-- Módulo: ai-advisor
-- Tabela genérica para qualquer "opinião estruturada de IA" no sistema —
-- generaliza o que era só `campaign_analyses` no MVP anterior.

CREATE TABLE IF NOT EXISTS ai_analyses (
  id BIGSERIAL PRIMARY KEY,
  subject_type TEXT NOT NULL,          -- 'product' | 'campaign' | outros no futuro
  subject_id INTEGER NOT NULL,
  question_type TEXT NOT NULL,         -- ex: 'campaign_budget_verdict', 'product_opportunity'
  provider TEXT NOT NULL,              -- 'claude' | 'openai'
  model TEXT NOT NULL,
  window_days INTEGER,
  verdict TEXT,                        -- campo curto pra filtrar/ordenar rápido sem abrir o JSON
  confidence TEXT,                     -- low | medium | high
  response JSONB NOT NULL,             -- resposta estruturada completa, validada contra o schema
  reasoning TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_subject ON ai_analyses(subject_type, subject_id, created_at DESC);
