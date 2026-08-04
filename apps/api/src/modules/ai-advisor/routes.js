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

module.exports = router;
