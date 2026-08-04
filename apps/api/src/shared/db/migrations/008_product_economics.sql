-- product_economics foi adicionado a 006_market_intel.sql depois que essa
-- migration já tinha sido aplicada em ambientes existentes. Esta migration
-- garante a criação da tabela nesses ambientes (IF NOT EXISTS é idempotente).

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
