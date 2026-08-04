// MÓDULO: discovery — repository
// Ver service.js para o estado da implementação (Fase 2).

const pool = require('../../shared/db/pool');

async function listProducts({ networkId, status } = {}) {
  const conditions = [];
  const params = [];
  if (networkId) { params.push(networkId); conditions.push(`network_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(`SELECT * FROM products ${where} ORDER BY last_seen_at DESC`, params);
  return rows;
}

async function findProductById(id) {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = { listProducts, findProductById };
