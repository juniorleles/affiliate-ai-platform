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
