const express = require('express');
const { requireAdmin } = require('../../shared/auth/middleware');
const service = require('./service');

const router = express.Router();

router.get('/:productId/ads', requireAdmin, async (req, res) => {
  const ads = await service.listCompetitorAds(req.params.productId);
  res.json({ ads });
});

router.post('/:productId/scan', requireAdmin, async (req, res) => {
  try {
    const result = await service.scanCompetitorsForProduct(req.params.productId);
    res.json(result);
  } catch (err) {
    res.status(501).json({ error: err.message });
  }
});

module.exports = router;
