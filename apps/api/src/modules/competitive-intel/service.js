// MÓDULO: competitive-intel (Módulo 3 do documento original)
// Status: STUB — schema pronto (migration 007_competitive_intel.sql). Implementação
// entra na Fase 4, e depende de uma decisão em aberto: fonte de dado (ferramenta de
// terceiros com API própria, ex: SpyFu/SEMrush/Adbeat/BigSpy, vs. scraping direto —
// ver docs/ARQUITETURA.md seção 9, item 1, antes de implementar qualquer coisa aqui).

const pool = require('../../shared/db/pool');

async function scanCompetitorsForProduct(productId) {
  throw new Error(
    'Não implementado ainda. Ver docs/ARQUITETURA.md Fase 4 — decisão de fonte de ' +
    'dado (seção 9) precisa ser confirmada antes de implementar este módulo.'
  );
}

async function listCompetitorAds(productId) {
  const { rows } = await pool.query(
    'SELECT * FROM competitor_ads WHERE product_id = $1 ORDER BY last_seen_at DESC',
    [productId]
  );
  return rows;
}

module.exports = { scanCompetitorsForProduct, listCompetitorAds };
