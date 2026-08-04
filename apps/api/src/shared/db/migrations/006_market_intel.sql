-- Módulo: market-intel (schema pronto, cálculo do score entra na Fase 3)

CREATE TABLE IF NOT EXISTS opportunity_scores (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  demand_score INTEGER,
  competition_score INTEGER,
  trend_score INTEGER,
  seasonality_score INTEGER,
  sales_page_quality_score INTEGER,
  reasoning TEXT,
  model_version TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_scores_product ON opportunity_scores(product_id, computed_at DESC);

-- Motor de Economics (seção 5.1) — resultado do cálculo determinístico de
-- viabilidade financeira, gravado a cada sincronização de produto.
CREATE TABLE IF NOT EXISTS product_economics (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  comissao_usada NUMERIC(12,2),
  taxa_conversao_esperada NUMERIC(6,4),
  margem_desejada_pct NUMERIC(6,2),
  cpc_maximo_calculado NUMERIC(12,4),
  comissao_minima_ok BOOLEAN,
  roi_estimado_pct NUMERIC(8,2),
  status TEXT NOT NULL, -- viavel | rejeitado_por_economics | rejeitado_por_comissao_minima | dado_insuficiente | erro_avaliacao
  calculado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_economics_product ON product_economics(product_id, calculado_em DESC);
