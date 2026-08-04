// MÓDULO: lpAudit (5.4) — decisão registrada em docs/ARQUITETURA.md seção 10, item 6:
// verificação MANUAL por enquanto (não Playwright). Você já está olhando a landing
// page no momento do cadastro do produto — esse módulo só estrutura esse registro,
// não tenta automatizar a checagem sozinho.

const pool = require('../../shared/db/pool');

async function recordAudit(productId, {
  hasCta, hasVsl, affiliateParamsPreserved, loadTimeMs, offerClarityScore, notes,
} = {}) {
  const { rows } = await pool.query(
    `INSERT INTO landing_page_audits
       (product_id, has_cta, has_vsl, load_time_ms, offer_clarity_score,
        affiliate_params_preserved, raw_findings)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      productId, hasCta ?? null, hasVsl ?? null, loadTimeMs ?? null,
      offerClarityScore ?? null, affiliateParamsPreserved ?? null,
      notes ? JSON.stringify({ notes, source: 'manual' }) : JSON.stringify({ source: 'manual' }),
    ]
  );
  return rows[0];
}

async function getLatestAudit(productId) {
  const { rows } = await pool.query(
    'SELECT * FROM landing_page_audits WHERE product_id = $1 ORDER BY audited_at DESC LIMIT 1',
    [productId]
  );
  return rows[0] || null;
}

module.exports = { recordAudit, getLatestAudit };
