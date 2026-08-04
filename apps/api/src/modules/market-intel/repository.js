const pool = require('../../shared/db/pool');

async function getLatestEconomics(productId) {
  const { rows } = await pool.query(
    'SELECT * FROM product_economics WHERE product_id = $1 ORDER BY calculado_em DESC LIMIT 1',
    [productId]
  );
  return rows[0] || null;
}

async function insertOpportunityScore(productId, data) {
  const { rows } = await pool.query(
    `INSERT INTO opportunity_scores
       (product_id, score, demand_score, competition_score, trend_score,
        seasonality_score, sales_page_quality_score, reasoning, model_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      productId, data.score, data.demandScore, data.competitionScore,
      data.trendScore ?? null, data.seasonalityScore ?? null,
      data.salesPageQualityScore, data.reasoning, data.modelVersion,
    ]
  );
  return rows[0];
}

async function getLatestScore(productId) {
  const { rows } = await pool.query(
    'SELECT * FROM opportunity_scores WHERE product_id = $1 ORDER BY computed_at DESC LIMIT 1',
    [productId]
  );
  return rows[0] || null;
}

module.exports = { getLatestEconomics, insertOpportunityScore, getLatestScore };
