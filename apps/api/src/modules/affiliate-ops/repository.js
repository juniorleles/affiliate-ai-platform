const pool = require('../../shared/db/pool');

async function findAffiliateByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM affiliates WHERE email = $1', [email]);
  return rows[0] || null;
}

async function findAffiliateByReferralCode(code) {
  const { rows } = await pool.query('SELECT * FROM affiliates WHERE referral_code = $1', [code]);
  return rows[0] || null;
}

async function findAffiliateById(id) {
  const { rows } = await pool.query('SELECT * FROM affiliates WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createAffiliate({ name, email, passwordHash, referralCode }) {
  const { rows } = await pool.query(
    `INSERT INTO affiliates (name, email, password_hash, referral_code)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, email, passwordHash, referralCode]
  );
  return rows[0];
}

async function updateAffiliate(id, { status, commissionType, commissionValue }) {
  const { rows } = await pool.query(
    `UPDATE affiliates SET
       status = COALESCE($2, status),
       commission_type = COALESCE($3, commission_type),
       commission_value = COALESCE($4, commission_value)
     WHERE id = $1 RETURNING *`,
    [id, status ?? null, commissionType ?? null, commissionValue ?? null]
  );
  return rows[0] || null;
}

async function listAffiliatesWithStats({ status, search } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(a.name ILIKE $${params.length} OR a.email ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(`
    SELECT
      a.id, a.name, a.email, a.referral_code, a.status, a.created_at,
      COUNT(DISTINCT c.id) AS total_clicks,
      COUNT(DISTINCT cv.id) AS total_conversions,
      COALESCE(SUM(cv.commission), 0) AS total_commission
    FROM affiliates a
    LEFT JOIN clicks c ON c.affiliate_id = a.id
    LEFT JOIN conversions cv ON cv.affiliate_id = a.id
    ${where}
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `, params);

  return rows;
}

async function insertClick({ affiliateId, destination, utmSource, utmMedium, utmCampaign, gclid, ip, userAgent }) {
  await pool.query(
    `INSERT INTO clicks (affiliate_id, destination, utm_source, utm_medium, utm_campaign, gclid, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [affiliateId, destination, utmSource, utmMedium, utmCampaign, gclid, ip, userAgent]
  );
}

async function findLastClick(affiliateId) {
  const { rows } = await pool.query(
    'SELECT id FROM clicks WHERE affiliate_id = $1 ORDER BY created_at DESC LIMIT 1',
    [affiliateId]
  );
  return rows[0] || null;
}

async function insertConversion({ affiliateId, clickId, orderRef, value, commission }) {
  const { rows } = await pool.query(
    `INSERT INTO conversions (affiliate_id, click_id, order_ref, value, commission, status)
     VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
    [affiliateId, clickId, orderRef, value, commission]
  );
  return rows[0];
}

async function updateConversionStatus(id, status) {
  const { rows } = await pool.query(
    'UPDATE conversions SET status = $2 WHERE id = $1 RETURNING *',
    [id, status]
  );
  return rows[0] || null;
}

async function getAffiliateTotals(affiliateId) {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM clicks WHERE affiliate_id = $1) AS total_clicks,
      (SELECT COUNT(*) FROM conversions WHERE affiliate_id = $1) AS total_conversions,
      (SELECT COALESCE(SUM(commission), 0) FROM conversions WHERE affiliate_id = $1 AND status != 'rejected') AS total_commission
  `, [affiliateId]);
  return rows[0];
}

async function getRecentConversions(affiliateId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT id, order_ref, value, commission, status, created_at
     FROM conversions WHERE affiliate_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [affiliateId, limit]
  );
  return rows;
}

async function getDashboardTotals() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM affiliates) AS total_affiliates,
      (SELECT COUNT(*) FROM affiliates WHERE status = 'active') AS active_affiliates,
      (SELECT COUNT(*) FROM clicks) AS total_clicks,
      (SELECT COUNT(*) FROM conversions) AS total_conversions,
      (SELECT COALESCE(SUM(value), 0) FROM conversions WHERE status != 'rejected') AS total_revenue,
      (SELECT COALESCE(SUM(commission), 0) FROM conversions WHERE status != 'rejected') AS total_commission,
      (SELECT COALESCE(SUM(commission), 0) FROM conversions WHERE status = 'pending') AS pending_commission
  `);
  return rows[0];
}

async function getRecentActivity(limit = 25) {
  const { rows } = await pool.query(`
    (SELECT 'click' AS type, c.created_at AS ts, a.name AS affiliate_name, c.utm_source AS detail
     FROM clicks c JOIN affiliates a ON a.id = c.affiliate_id)
    UNION ALL
    (SELECT 'conversion' AS type, cv.created_at AS ts, a.name AS affiliate_name,
       ('R$ ' || TO_CHAR(cv.value, 'FM999999990.00')) AS detail
     FROM conversions cv JOIN affiliates a ON a.id = cv.affiliate_id)
    ORDER BY ts DESC
    LIMIT $1
  `, [limit]);
  return rows;
}

module.exports = {
  findAffiliateByEmail,
  findAffiliateByReferralCode,
  findAffiliateById,
  createAffiliate,
  updateAffiliate,
  listAffiliatesWithStats,
  insertClick,
  findLastClick,
  insertConversion,
  updateConversionStatus,
  getAffiliateTotals,
  getRecentConversions,
  getDashboardTotals,
  getRecentActivity,
};
