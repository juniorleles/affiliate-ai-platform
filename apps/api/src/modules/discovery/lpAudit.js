// MÓDULO: lpAudit (5.4)
// Nível 1 (manual): decisão registrada em docs/ARQUITETURA.md seção 10, item 6 —
// verificação manual, sem Playwright. recordAudit()/getLatestAudit() cobrem isso.
//
// Nível 2 / Camada A (2026-08-05): análise rica por IA, baseada em texto da
// página + performance real (PageSpeed Insights).
//
// Camada B (2026-08-05): análise visual via screenshot (ScreenshotOne) + IA com
// visão — complementa a Camada A, não substitui.

const pool = require('../../shared/db/pool');
const { fetchPageText } = require('./lpTextFetch');
const { fetchPageSpeed } = require('../../shared/pagespeed');
const { fetchDesktopAndMobile } = require('../../shared/screenshot');
const aiAdvisor = require('../ai-advisor/service');

async function recordAudit(productId, {
  hasCta, hasVsl, affiliateParamsPreserved, loadTimeMs, offerClarityScore, notes,
} = {}) {
  const { rows } = await pool.query(
    `INSERT INTO landing_page_audits
       (product_id, has_cta, has_vsl, load_time_ms, offer_clarity_score,
        affiliate_params_preserved, raw_findings, analysis_tier)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'manual') RETURNING *`,
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

async function getLatestAdvancedAudit(productId) {
  const { rows } = await pool.query(
    `SELECT * FROM landing_page_audits
     WHERE product_id = $1 AND analysis_tier IN ('camada_a', 'camada_b')
     ORDER BY audited_at DESC LIMIT 1`,
    [productId]
  );
  return rows[0] || null;
}

/**
 * Roda a Camada A do Auditor de LP avançado: busca o texto real da página +
 * performance real (PageSpeed), chama a IA, grava o relatório completo.
 * Lança erro claro se a URL não estiver disponível ou não puder ser lida —
 * nunca finge que analisou uma página que não conseguiu buscar.
 */
async function runAdvancedAuditTextOnly(product, { adInfo, targetInfo } = {}) {
  if (!product.sales_page_url) {
    throw new Error('Produto não tem URL de página de vendas cadastrada. Preencha salesPageUrl antes de rodar a auditoria avançada.');
  }

  const pageText = await fetchPageText(product.sales_page_url);

  let pageSpeed = null;
  try {
    pageSpeed = await fetchPageSpeed(product.sales_page_url, 'mobile');
  } catch (err) {
    console.warn('[lp-audit] PageSpeed Insights falhou, seguindo sem dado de performance:', err.message);
  }

  const { analysis, result } = await aiAdvisor.analyzeLandingPageText({
    productId: product.id,
    pageText,
    pageSpeed,
    product,
    adInfo,
    targetInfo,
  });

  const { rows } = await pool.query(
    `INSERT INTO landing_page_audits
       (product_id, analysis_tier, conversion_score, score_classification, ai_report)
     VALUES ($1, 'camada_a', $2, $3, $4) RETURNING *`,
    [product.id, result.landing_page_conversion_score, result.score_classification, JSON.stringify(result)]
  );

  return { audit: rows[0], analysis, result, pageSpeed };
}

/**
 * Roda a Camada B: captura screenshot desktop+mobile via ScreenshotOne, chama a
 * IA com visão, grava o relatório visual. Complementa a Camada A (texto), não
 * substitui — os dois relatórios convivem lado a lado (seção 10, item 8).
 */
async function runAdvancedAuditVisual(product) {
  if (!product.sales_page_url) {
    throw new Error('Produto não tem URL de página de vendas cadastrada. Preencha salesPageUrl antes de rodar a auditoria visual.');
  }

  const { desktop, mobile } = await fetchDesktopAndMobile(product.sales_page_url);

  const { analysis, result } = await aiAdvisor.analyzeLandingPageVisual({
    productId: product.id,
    desktopBase64: desktop,
    mobileBase64: mobile,
    product,
  });

  const { rows } = await pool.query(
    `INSERT INTO landing_page_audits
       (product_id, analysis_tier, conversion_score, ai_report)
     VALUES ($1, 'camada_b', $2, $3) RETURNING *`,
    [product.id, result.score_visual_parcial, JSON.stringify(result)]
  );

  return { audit: rows[0], analysis, result };
}

module.exports = {
  recordAudit, getLatestAudit, getLatestAdvancedAudit,
  runAdvancedAuditTextOnly, runAdvancedAuditVisual,
};
