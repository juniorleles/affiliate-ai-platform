-- Pesquisa de palavra-chave e leilão (5.2) — docs/ARQUITETURA.md

CREATE TABLE IF NOT EXISTS keyword_metrics (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  keyword_text TEXT NOT NULL,
  avg_monthly_searches BIGINT,
  competition_level TEXT,       -- low | medium | high
  competition_index INTEGER,
  top_of_page_bid_low NUMERIC(12,4),
  top_of_page_bid_high NUMERIC(12,4),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_keyword_metrics_product ON keyword_metrics(product_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_keyword_metrics_keyword ON keyword_metrics(keyword_text);
