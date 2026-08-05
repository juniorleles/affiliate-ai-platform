const pool = require('../../shared/db/pool');

async function findOrCreateCompetitor(name, domain) {
  const { rows } = await pool.query('SELECT * FROM competitors WHERE name = $1', [name]);
  if (rows[0]) return rows[0];

  const inserted = await pool.query(
    'INSERT INTO competitors (name, domain) VALUES ($1, $2) RETURNING *',
    [name, domain || null]
  );
  return inserted.rows[0];
}

async function findMatchingAd(competitorId, headline, landingPageUrl) {
  const { rows } = await pool.query(
    `SELECT * FROM competitor_ads
     WHERE competitor_id = $1 AND headline = $2
       AND (landing_page_url IS NOT DISTINCT FROM $3)
     LIMIT 1`,
    [competitorId, headline, landingPageUrl || null]
  );
  return rows[0] || null;
}

async function insertCompetitorAd({ competitorId, productId, platform, headline, body, creativeUrl, landingPageUrl }) {
  const { rows } = await pool.query(
    `INSERT INTO competitor_ads
       (competitor_id, product_id, platform, headline, body, creative_url, landing_page_url,
        is_active, first_seen_at, last_seen_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, true, now(), now())
     RETURNING *`,
    [competitorId, productId || null, platform, headline, body || null, creativeUrl || null, landingPageUrl || null]
  );
  return rows[0];
}

async function touchAdLastSeen(adId) {
  const { rows } = await pool.query(
    'UPDATE competitor_ads SET last_seen_at = now(), is_active = true WHERE id = $1 RETURNING *',
    [adId]
  );
  return rows[0];
}

async function insertSnapshot(adId, rawData) {
  const { rows } = await pool.query(
    'INSERT INTO competitor_ad_snapshots (competitor_ad_id, raw_data) VALUES ($1, $2) RETURNING *',
    [adId, JSON.stringify(rawData)]
  );
  return rows[0];
}

async function getSnapshotHistory(adId) {
  const { rows } = await pool.query(
    'SELECT * FROM competitor_ad_snapshots WHERE competitor_ad_id = $1 ORDER BY captured_at DESC',
    [adId]
  );
  return rows;
}

async function listAdsForProduct(productId) {
  const { rows } = await pool.query(
    `SELECT ca.*, c.name AS competitor_name, c.domain AS competitor_domain,
       (SELECT COUNT(*) FROM competitor_ad_snapshots WHERE competitor_ad_id = ca.id) AS snapshot_count
     FROM competitor_ads ca
     JOIN competitors c ON c.id = ca.competitor_id
     WHERE ca.product_id = $1
     ORDER BY ca.last_seen_at DESC`,
    [productId]
  );
  return rows;
}

async function listAllAds() {
  const { rows } = await pool.query(
    `SELECT ca.*, c.name AS competitor_name, c.domain AS competitor_domain,
       (SELECT COUNT(*) FROM competitor_ad_snapshots WHERE competitor_ad_id = ca.id) AS snapshot_count
     FROM competitor_ads ca
     JOIN competitors c ON c.id = ca.competitor_id
     ORDER BY ca.last_seen_at DESC`
  );
  return rows;
}

module.exports = {
  findOrCreateCompetitor,
  findMatchingAd,
  insertCompetitorAd,
  touchAdLastSeen,
  insertSnapshot,
  getSnapshotHistory,
  listAdsForProduct,
  listAllAds,
};
