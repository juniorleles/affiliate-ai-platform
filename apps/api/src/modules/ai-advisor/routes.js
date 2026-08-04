const express = require('express');
const { requireAdmin } = require('../../shared/auth/middleware');
const service = require('./service');

const router = express.Router();

// Histórico genérico de análises de IA, útil pra qualquer módulo (campanha, produto, ...)
// GET /api/ai-advisor/analyses?subject_type=campaign&subject_id=5
router.get('/analyses', requireAdmin, async (req, res) => {
  const { subject_type, subject_id } = req.query;
  if (!subject_type || !subject_id) {
    return res.status(400).json({ error: 'subject_type e subject_id são obrigatórios.' });
  }
  const analyses = await service.getHistory(subject_type, Number(subject_id));
  res.json({ analyses });
});

// Loop de aprendizado: registra o resultado real de uma análise já feita.
// Body: { status: 'confirmed_good' | 'confirmed_bad' | 'ignored', notes? }
router.patch('/analyses/:id/outcome', requireAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body || {};
    const analysis = await service.recordOutcome(req.params.id, { status, notes });
    if (!analysis) return res.status(404).json({ error: 'Análise não encontrada.' });
    res.json({ analysis });
  } catch (err) {
    res.status(err.httpStatus || 500).json({ error: err.message });
  }
});

// Placar do loop de aprendizado — taxa de acerto agregada.
// GET /api/ai-advisor/accuracy?subject_type=campaign&question_type=campaign_budget_verdict
router.get('/accuracy', requireAdmin, async (req, res) => {
  const stats = await service.getAccuracyStats(req.query);
  res.json({ stats });
});

module.exports = router;
