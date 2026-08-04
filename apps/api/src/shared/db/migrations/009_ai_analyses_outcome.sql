-- Loop de aprendizado (docs/ARQUITETURA.md, seção 1, reorientação estratégica de
-- 2026-08-04): toda análise de IA passa a poder ser confirmada depois contra o
-- resultado real, pra virar histórico calibrável em vez de opinião isolada.

ALTER TABLE ai_analyses
  ADD COLUMN outcome_status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed_good | confirmed_bad | ignored
  ADD COLUMN outcome_notes TEXT,
  ADD COLUMN outcome_recorded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ai_analyses_outcome ON ai_analyses(outcome_status);
