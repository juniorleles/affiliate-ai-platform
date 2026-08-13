const pool = require('../../shared/db/pool');

async function countUsers() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  return rows[0].count;
}

async function findByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function listUsers() {
  const { rows } = await pool.query(
    'SELECT id, email, name, role, is_active, created_at FROM users ORDER BY created_at'
  );
  return rows;
}

async function createUser({ email, passwordHash, name, role }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, is_active, created_at`,
    [email, passwordHash, name || null, role || 'administrador']
  );
  return rows[0];
}

async function updateUser(id, { role, isActive, name }) {
  const { rows } = await pool.query(
    `UPDATE users SET
       role = COALESCE($2, role),
       is_active = COALESCE($3, is_active),
       name = COALESCE($4, name)
     WHERE id = $1
     RETURNING id, email, name, role, is_active, created_at`,
    [id, role || null, isActive != null ? isActive : null, name || null]
  );
  return rows[0] || null;
}

module.exports = { countUsers, findByEmail, findById, listUsers, createUser, updateUser };
