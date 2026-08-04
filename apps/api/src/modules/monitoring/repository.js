const pool = require('../../shared/db/pool');

async function createAlert({ type, severity, subjectType, subjectId, message }) {
  const { rows } = await pool.query(
    `INSERT INTO alerts (type, severity, subject_type, subject_id, message)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [type, severity, subjectType, subjectId, message]
  );
  return rows[0];
}

async function hasOpenAlert(type, subjectType, subjectId) {
  const { rows } = await pool.query(
    `SELECT id FROM alerts
     WHERE type = $1 AND subject_type = $2 AND subject_id = $3 AND status = 'open'
     LIMIT 1`,
    [type, subjectType, subjectId]
  );
  return !!rows[0];
}

async function listAlerts({ status } = {}) {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = 'WHERE status = $1';
  }
  const { rows } = await pool.query(
    `SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  return rows;
}

async function updateAlertStatus(id, status) {
  const resolvedAt = status === 'resolved' ? 'now()' : 'NULL';
  const { rows } = await pool.query(
    `UPDATE alerts SET status = $2, resolved_at = ${status === 'resolved' ? 'now()' : 'resolved_at'}
     WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return rows[0] || null;
}

module.exports = { createAlert, hasOpenAlert, listAlerts, updateAlertStatus };
