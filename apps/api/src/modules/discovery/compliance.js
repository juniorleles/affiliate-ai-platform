// MÓDULO: compliance (5.3) — fatos objetivos ficam aqui (producer_compliance);
// a classificação de nicho por IA é feita pelo ai-advisor (dono de ai_analyses
// e do loop de aprendizado), não direto por este módulo.

const pool = require('../../shared/db/pool');
const aiAdvisor = require('../ai-advisor/service');

/**
 * Grava os fatos objetivos (se fornecidos) + a classificação de nicho (via IA,
 * delegada ao ai-advisor — fica registrada em ai_analyses com outcome_status
 * 'pending', pronta pro loop de aprendizado).
 */
async function evaluateCompliance(productId, product, {
  allowsBrandBidding, allowsBottomFunnel, requiresPresell, source = 'manual',
} = {}) {
  let aiResult = null;
  try {
    const { result } = await aiAdvisor.classifyProductCompliance({ productId, ...product });
    aiResult = result;
  } catch (err) {
    // Não deixa a falta de IA travar o cadastro do produto — grava os fatos
    // objetivos mesmo assim, niche_sensitivity fica null até reprocessar.
    console.error('Erro ao classificar compliance via IA:', err.message);
  }

  const { rows } = await pool.query(
    `INSERT INTO producer_compliance
       (product_id, allows_brand_bidding, allows_bottom_funnel, requires_presell,
        niche_sensitivity, compliance_notes, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      productId, allowsBrandBidding ?? null, allowsBottomFunnel ?? null,
      requiresPresell ?? aiResult?.requires_presell_recommendation ?? null,
      aiResult?.niche_sensitivity ?? null, aiResult?.reasoning ?? null, source,
    ]
  );

  return { compliance: rows[0], aiRiskFlags: aiResult?.risk_flags ?? [] };
}

module.exports = { evaluateCompliance };
