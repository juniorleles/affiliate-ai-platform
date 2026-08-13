const pool = require('../../shared/db/pool');

// Distingue as leituras do Decision Engine (evidence-engine-v1) das leituras
// antigas do Market Intelligence (deterministic-v1) na mesma tabela
// opportunity_scores — reaproveitada de propósito, ver migration 017.
const MODEL_VERSION = 'evidence-engine-v1';

async function saveDecision(productId, {
  opportunityScore, confidenceScore, decisionStatus, evidenceStage, stoppedReason,
  demandScore, competitionScore, salesPageQualityScore, reasoning,
}) {
  const { rows } = await pool.query(
    `INSERT INTO opportunity_scores
       (product_id, score, demand_score, competition_score, sales_page_quality_score,
        reasoning, model_version, confidence_score, decision_status, evidence_stage, stopped_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      productId, opportunityScore, demandScore ?? null, competitionScore ?? null,
      salesPageQualityScore ?? null, reasoning ?? null, MODEL_VERSION,
      confidenceScore, decisionStatus, evidenceStage, stoppedReason ?? null,
    ]
  );
  return rows[0];
}

async function getLatestDecision(productId) {
  const { rows } = await pool.query(
    `SELECT * FROM opportunity_scores
     WHERE product_id = $1 AND model_version = $2
     ORDER BY computed_at DESC LIMIT 1`,
    [productId, MODEL_VERSION]
  );
  return rows[0] || null;
}

module.exports = { saveDecision, getLatestDecision, MODEL_VERSION };
