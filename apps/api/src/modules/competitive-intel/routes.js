const express = require('express');
const { requireAdmin } = require('../../shared/auth/middleware');
const service = require('./service');

const router = express.Router();

// Lista todos os anúncios de concorrentes já cadastrados (qualquer produto).
router.get('/', requireAdmin, async (req, res) => {
  const ads = await service.listAllCompetitorAds();
  res.json({ ads });
});

// Cadastro manual — a partir do que você viu no Google Ads Transparency Center.
// Body: { competitorName, competitorDomain?, productId?, platform?, headline,
//         body?, creativeUrl?, landingPageUrl? }
router.post('/manual', requireAdmin, async (req, res) => {
  try {
    const result = await service.addManualCompetitorAd(req.body);
    res.status(201).json(result);
  } catch (err) {
    console.error('Erro ao cadastrar anúncio de concorrente:', err);
    res.status(400).json({ error: err.message || 'Falha ao cadastrar anúncio de concorrente.' });
  }
});

router.get('/:productId/ads', requireAdmin, async (req, res) => {
  const ads = await service.listCompetitorAds(req.params.productId);
  res.json({ ads });
});

router.get('/ads/:adId/history', requireAdmin, async (req, res) => {
  const history = await service.getAdHistory(req.params.adId);
  res.json({ history });
});

module.exports = router;
