-- Evidence Engine + Decision Engine (2026-08-06). Sem tabela nova de propósito
-- — reaproveita opportunity_scores (já é "score de produto ao longo do
-- tempo") e keyword_metrics (já guarda a pesquisa em si), só adiciona o que
-- falta pra essa metodologia nova conviver com a antiga sem confundir.

ALTER TABLE opportunity_scores
  ADD COLUMN confidence_score INTEGER,
  ADD COLUMN decision_status TEXT,      -- testar | investigar | descartar
  ADD COLUMN evidence_stage TEXT,       -- até onde o pipeline rodou antes de decidir
  ADD COLUMN stopped_reason TEXT;       -- por que parou nessa etapa (auditoria/depuração)

-- Sem isso, não dá pra saber com segurança se a pesquisa de intenção
-- comercial já rodou pra um produto (idempotência do pipeline depende disso).
-- DEFAULT 'generic' preserva o significado das linhas já existentes.
ALTER TABLE keyword_metrics
  ADD COLUMN research_source TEXT NOT NULL DEFAULT 'generic'; -- generic | commercial_intent
