// MÓDULO: discovery — repository

const pool = require('../../shared/db/pool');

async function listProducts({ networkId, status } = {}) {
  const conditions = [];
  const params = [];
  if (networkId) { params.push(networkId); conditions.push(`p.network_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`pe.status = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(`
    SELECT
      p.*,
      n.name AS network_name,
      n.type AS network_type,
      pe.status AS economics_status,
      pe.cpc_maximo_calculado,
      pe.calculado_em AS economics_calculado_em,
      pc.niche_sensitivity,
      pc.requires_presell,
      pc.checked_at AS compliance_checked_at,
      lpa.has_cta,
      lpa.has_vsl,
      lpa.affiliate_params_preserved,
      lpa.audited_at AS lp_audited_at
    FROM products p
    JOIN networks n ON n.id = p.network_id
    LEFT JOIN LATERAL (
      SELECT * FROM product_economics
      WHERE product_id = p.id
      ORDER BY calculado_em DESC
      LIMIT 1
    ) pe ON true
    LEFT JOIN LATERAL (
      SELECT * FROM producer_compliance
      WHERE product_id = p.id
      ORDER BY checked_at DESC
      LIMIT 1
    ) pc ON true
    LEFT JOIN LATERAL (
      SELECT * FROM landing_page_audits
      WHERE product_id = p.id
      ORDER BY audited_at DESC
      LIMIT 1
    ) lpa ON true
    ${where}
    ORDER BY p.last_seen_at DESC
  `, params);
  return rows;
}

async function findProductById(id) {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return rows[0] || null;
}

async function getLatestCompliance(productId) {
  const { rows } = await pool.query(
    'SELECT * FROM producer_compliance WHERE product_id = $1 ORDER BY checked_at DESC LIMIT 1',
    [productId]
  );
  return rows[0] || null;
}

async function getLatestLpAudit(productId) {
  const { rows } = await pool.query(
    'SELECT * FROM landing_page_audits WHERE product_id = $1 ORDER BY audited_at DESC LIMIT 1',
    [productId]
  );
  return rows[0] || null;
}

module.exports = { listProducts, findProductById, getLatestCompliance, getLatestLpAudit };
