// MÓDULO: market-intel (Módulo 2 do documento original)
// Status: STUB — schema pronto (migration 006_market_intel.sql). Implementação
// entra na Fase 3, depois que o discovery já estiver trazendo produtos de verdade
// (ver docs/ARQUITETURA.md seção 8).
//
// Quando for implementar:
// - Combine sinais determinísticos (sazonalidade por categoria, ticket médio,
//   dados de tendência de algum provider externo) com 1 chamada de IA (via
//   shared/ai-provider, schema `productOpportunity`) para o reasoning qualitativo.
// - Não jogue tudo pra IA decidir — o que dá pra calcular direto (ex: EPC x preço)
//   deve ser calculado direto; a IA entra pra interpretar o conjunto e explicar.

const pool = require('../../shared/db/pool');

async function scoreProduct(productId) {
  throw new Error(
    'Não implementado ainda. Ver docs/ARQUITETURA.md Fase 3 — calcular sub-scores ' +
    'determinísticos e chamar shared/ai-provider com o schema productOpportunity.'
  );
}

async function getLatestScore(productId) {
  const { rows } = await pool.query(
    'SELECT * FROM opportunity_scores WHERE product_id = $1 ORDER BY computed_at DESC LIMIT 1',
    [productId]
  );
  return rows[0] || null;
}

module.exports = { scoreProduct, getLatestScore };
