const express = require('express');
const { requireAdmin } = require('../../shared/auth/middleware');
const service = require('./service');

const router = express.Router();

function handleServiceError(res, err) {
  res.status(err.status || 500).json({ error: err.message || 'Erro interno.' });
}

// Roda (ou retoma) o pipeline de evidência progressiva pro produto. Idempotente
// — chamar de novo não duplica pesquisa de keyword já feita.
router.post('/:productId/evaluate', requireAdmin, async (req, res) => {
  try {
    const result = await service.evaluateProduct(req.params.productId);
    res.json(result);
  } catch (err) { handleServiceError(res, err); }
});

router.get('/:productId/status', requireAdmin, async (req, res) => {
  const decision = await service.getLatestDecision(req.params.productId);
  res.json({ decision });
});

module.exports = router;
