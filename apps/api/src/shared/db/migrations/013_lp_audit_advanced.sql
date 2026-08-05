-- Fase 3d, Camada A — Auditor de LP avançado (docs/ARQUITETURA.md seção 5.4, Nível 2).
-- Reaproveita a tabela landing_page_audits (Nível 1) em vez de criar uma nova — só
-- adiciona colunas pro relatório rico. analysis_tier distingue um registro manual
-- (Nível 1) de uma análise avançada por IA (Camada A ou B).

ALTER TABLE landing_page_audits
  ADD COLUMN analysis_tier TEXT NOT NULL DEFAULT 'manual', -- manual | camada_a | camada_b
  ADD COLUMN conversion_score INTEGER,
  ADD COLUMN score_classification TEXT, -- excelente | muito_boa | boa | precisa_melhorias | fraca | critica
  ADD COLUMN ai_report JSONB; -- relatório estruturado completo (schema landingPageAuditReport)

CREATE INDEX IF NOT EXISTS idx_lp_audits_tier ON landing_page_audits(product_id, analysis_tier, audited_at DESC);
