const pool = require('../../shared/db/pool');

async function recordAnalysis({
  subjectType, subjectId, questionType, provider, model,
  windowDays, verdict, confidence, response, reasoning,
}) {
  const { rows } = await pool.query(
    `INSERT INTO ai_analyses
       (subject_type, subject_id, question_type, provider, model, window_days,
        verdict, confidence, response, reasoning)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [subjectType, subjectId, questionType, provider, model, windowDays ?? null,
      verdict ?? null, confidence ?? null, response, reasoning]
  );
  return rows[0];
}

async function getHistory(subjectType, subjectId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT * FROM ai_analyses
     WHERE subject_type = $1 AND subject_id = $2
     ORDER BY created_at DESC LIMIT $3`,
    [subjectType, subjectId, limit]
  );
  return rows;
}

async function getLatest(subjectType, subjectId) {
  const { rows } = await pool.query(
    `SELECT * FROM ai_analyses
     WHERE subject_type = $1 AND subject_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [subjectType, subjectId]
  );
  return rows[0] || null;
}

/**
 * Loop de aprendizado: registra o resultado real de uma análise já feita.
 * Chamado manualmente (ou depois, por uma rotina) quando dá pra confirmar se
 * o veredito da IA bateu com a realidade.
 */
async function recordOutcome(id, { status, notes }) {
  const allowed = ['pending', 'confirmed_good', 'confirmed_bad', 'ignored'];
  if (!allowed.includes(status)) {
    throw Object.assign(
      new Error(`status deve ser um de: ${allowed.join(', ')}`),
      { httpStatus: 400 }
    );
  }
  const { rows } = await pool.query(
    `UPDATE ai_analyses SET outcome_status = $2, outcome_notes = $3, outcome_recorded_at = now()
     WHERE id = $1 RETURNING *`,
    [id, status, notes ?? null]
  );
  return rows[0] || null;
}

/**
 * Taxa de acerto agregada — o "placar" do loop de aprendizado. Serve pra
 * responder "a IA está acertando?" com número, não com sensação.
 */
async function getAccuracyStats({ subjectType, questionType } = {}) {
  const conditions = ["outcome_status IN ('confirmed_good', 'confirmed_bad')"];
  const params = [];
  if (subjectType) { params.push(subjectType); conditions.push(`subject_type = $${params.length}`); }
  if (questionType) { params.push(questionType); conditions.push(`question_type = $${params.length}`); }

  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE outcome_status = 'confirmed_good') AS acertos,
      COUNT(*) FILTER (WHERE outcome_status = 'confirmed_bad') AS erros,
      COUNT(*) AS total_confirmado,
      (SELECT COUNT(*) FROM ai_analyses WHERE outcome_status = 'pending') AS ainda_pendente
    FROM ai_analyses
    WHERE ${conditions.join(' AND ')}
  `, params);

  const row = rows[0];
  const total = Number(row.total_confirmado);
  return {
    acertos: Number(row.acertos),
    erros: Number(row.erros),
    total_confirmado: total,
    taxa_acerto_pct: total > 0 ? Math.round((Number(row.acertos) / total) * 10000) / 100 : null,
    ainda_pendente: Number(row.ainda_pendente),
  };
}

module.exports = { recordAnalysis, getHistory, getLatest, recordOutcome, getAccuracyStats };
