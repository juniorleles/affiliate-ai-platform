const pool = require('../../shared/db/pool');

async function upsertCampaignsAndMetrics(rows) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const row of rows) {
      const { rows: campaignRows } = await client.query(
        `INSERT INTO campaigns (google_campaign_id, name, status, channel_type, last_synced_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (google_campaign_id) DO UPDATE SET
           name = EXCLUDED.name, status = EXCLUDED.status,
           channel_type = EXCLUDED.channel_type, last_synced_at = EXCLUDED.last_synced_at
         RETURNING id`,
        [row.campaignId, row.campaignName, row.status, row.channelType]
      );
      const campaignId = campaignRows[0].id;

      await client.query(
        `INSERT INTO campaign_metrics_daily
           (campaign_id, date, impressions, clicks, cost, google_conversions, google_conversions_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (campaign_id, date) DO UPDATE SET
           impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks, cost = EXCLUDED.cost,
           google_conversions = EXCLUDED.google_conversions,
           google_conversions_value = EXCLUDED.google_conversions_value`,
        [campaignId, row.date, row.impressions, row.clicks, row.cost, row.conversions, row.conversionsValue]
      );
    }

    await client.query('COMMIT');
    return rows.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listCampaignsWithMetrics() {
  const { rows } = await pool.query(`
    SELECT
      c.id, c.google_campaign_id, c.name, c.status, c.target_cpa, c.target_roas, c.last_synced_at,
      COALESCE(SUM(m.cost), 0) AS cost_30d,
      COALESCE(SUM(m.clicks), 0) AS clicks_30d,
      COALESCE(SUM(m.impressions), 0) AS impressions_30d,
      COALESCE(SUM(m.google_conversions), 0) AS google_conversions_30d,
      COALESCE(SUM(m.google_conversions_value), 0) AS google_conversions_value_30d
    FROM campaigns c
    LEFT JOIN campaign_metrics_daily m ON m.campaign_id = c.id AND m.date >= (CURRENT_DATE - INTERVAL '30 days')
    GROUP BY c.id
    ORDER BY cost_30d DESC
  `);
  return rows;
}

async function getAffiliateStatsByCampaignName() {
  const { rows } = await pool.query(`
    SELECT LOWER(cl.utm_campaign) AS campaign_name,
      COUNT(DISTINCT cv.id) AS conversions,
      COALESCE(SUM(cv.value), 0) AS revenue
    FROM clicks cl
    JOIN conversions cv ON cv.click_id = cl.id AND cv.status != 'rejected'
    WHERE cl.utm_campaign IS NOT NULL
    GROUP BY LOWER(cl.utm_campaign)
  `);
  return rows;
}

async function getAffiliateStatsForCampaign(campaignName) {
  const { rows } = await pool.query(`
    SELECT COUNT(DISTINCT cv.id) AS conversions, COALESCE(SUM(cv.value), 0) AS revenue
    FROM clicks cl
    JOIN conversions cv ON cv.click_id = cl.id AND cv.status != 'rejected'
    WHERE LOWER(cl.utm_campaign) = LOWER($1)
  `, [campaignName]);
  return rows[0];
}

async function getLatestAnalysesByCampaign() {
  const { rows } = await pool.query(`
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY subject_id ORDER BY created_at DESC) AS rn
      FROM ai_analyses WHERE subject_type = 'campaign'
    ) t WHERE rn = 1
  `);
  return rows;
}

async function findCampaignById(id) {
  const { rows } = await pool.query('SELECT * FROM campaigns WHERE id = $1', [id]);
  return rows[0] || null;
}

async function updateCampaignTargets(id, { targetCpa, targetRoas }) {
  const { rows } = await pool.query(
    `UPDATE campaigns SET
       target_cpa = COALESCE($2, target_cpa),
       target_roas = COALESCE($3, target_roas)
     WHERE id = $1 RETURNING *`,
    [id, targetCpa ?? null, targetRoas ?? null]
  );
  return rows[0] || null;
}

async function getDailyMetrics(campaignId) {
  const { rows } = await pool.query(`
    SELECT date, impressions, clicks, cost, google_conversions, google_conversions_value
    FROM campaign_metrics_daily
    WHERE campaign_id = $1 AND date >= (CURRENT_DATE - INTERVAL '30 days')
    ORDER BY date ASC
  `, [campaignId]);
  return rows;
}

async function listAllCampaigns() {
  const { rows } = await pool.query('SELECT * FROM campaigns');
  return rows;
}

async function insertKeywordMetrics(productId, ideas) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const idea of ideas) {
      await client.query(
        `INSERT INTO keyword_metrics
           (product_id, keyword_text, avg_monthly_searches, competition_level,
            competition_index, top_of_page_bid_low, top_of_page_bid_high)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [productId, idea.keywordText, idea.avgMonthlySearches, idea.competitionLevel,
          idea.competitionIndex, idea.topOfPageBidLow, idea.topOfPageBidHigh]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getLatestKeywordMetrics(productId) {
  const { rows } = await pool.query(
    'SELECT * FROM keyword_metrics WHERE product_id = $1 ORDER BY captured_at DESC LIMIT 20',
    [productId]
  );
  return rows;
}

module.exports = {
  upsertCampaignsAndMetrics,
  listCampaignsWithMetrics,
  getAffiliateStatsByCampaignName,
  getAffiliateStatsForCampaign,
  getLatestAnalysesByCampaign,
  findCampaignById,
  updateCampaignTargets,
  getDailyMetrics,
  listAllCampaigns,
  insertKeywordMetrics,
  getLatestKeywordMetrics,
};
