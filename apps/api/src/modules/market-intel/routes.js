const express = require('express');
const { requireAdmin } = require('../../shared/auth/middleware');
const service = require('./service');

const router = express.Router();

router.get('/:productId/score', requireAdmin, async (req, res) => {
  const score = await service.getLatestScore(req.params.productId);
  res.json({ score });
});

router.post('/:productId/score', requireAdmin, async (req, res) => {
  try {
    const score = await service.scoreProduct(req.params.productId);
    res.json({ score });
  } catch (err) {
    res.status(501).json({ error: err.message });
  }
});

module.exports = router;
