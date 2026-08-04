const express = require('express');
const { requireAdmin } = require('../../shared/auth/middleware');
const service = require('./service');

const router = express.Router();

// Testa o motor de Economics (5.1) diretamente, sem depender de um produto real no
// banco — útil pra validar/ajustar a fórmula antes do connector de Discovery existir.
// Body: { comissaoEsperada, taxaConversaoEsperada, margemDesejadaPct?, comissaoMinima?, cpcLeilao? }
router.post('/economics/evaluate', requireAdmin, (req, res) => {
  try {
    const result = service.evaluateEconomics(req.body);
    res.json({ result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:productId/score', requireAdmin, async (req, res) => {
  const score = await service.getLatestScore(req.params.productId);
  res.json({ score });
});

// Roda o pipeline completo da Fase 3b: score determinístico + as 8 perguntas
// originais respondidas pela IA (schema productOpportunity).
router.post('/:productId/analyze', requireAdmin, async (req, res) => {
  try {
    const result = await service.scoreProduct(req.params.productId);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
