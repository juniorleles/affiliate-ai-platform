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

module.exports = { recordAnalysis, getHistory, getLatest };
