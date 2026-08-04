const express = require('express');
const { requireAdmin } = require('../../shared/auth/middleware');
const service = require('./service');

const router = express.Router();

function handleServiceError(res, err) {
  const status = err.status || 502;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Erro ao processar a requisição.' });
}

router.post('/sync', requireAdmin, async (req, res) => {
  try {
    const count = await service.syncCampaigns();
    res.json({ synced: count });
  } catch (err) { handleServiceError(res, err); }
});

router.get('/', requireAdmin, async (req, res) => {
  try {
    const campaigns = await service.listCampaigns();
    res.json({ campaigns });
  } catch (err) { handleServiceError(res, err); }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const campaign = await service.updateCampaignTargets(req.params.id, req.body);
    res.json({ campaign });
  } catch (err) { handleServiceError(res, err); }
});

router.post('/:id/analyze', requireAdmin, async (req, res) => {
  try {
    const analysis = await service.analyzeCampaign(req.params.id);
    res.json({ analysis });
  } catch (err) { handleServiceError(res, err); }
});

router.get('/:id/history', requireAdmin, async (req, res) => {
  try {
    const analyses = await service.getCampaignHistory(req.params.id);
    res.json({ analyses });
  } catch (err) { handleServiceError(res, err); }
});

// Fase 2b — pesquisa palavra-chave/leilão pra um produto (não uma campanha).
// Body: { seedKeyword?, minCommission? } — sem seedKeyword, usa o nome do produto.
router.post('/keyword-research/:productId', requireAdmin, async (req, res) => {
  try {
    const { seedKeyword, minCommission } = req.body || {};
    const result = await service.researchKeywordsForProduct(req.params.productId, { seedKeyword, minCommission });
    res.json(result);
  } catch (err) { handleServiceError(res, err); }
});

router.get('/keyword-research/:productId', requireAdmin, async (req, res) => {
  const metrics = await service.getKeywordMetrics(req.params.productId);
  res.json({ metrics });
});

// Utilitário: qual moeda a conta do Google Ads usa de verdade (não assumir).
router.get('/account-currency', requireAdmin, async (req, res) => {
  try {
    const currency = await service.getAccountCurrency();
    res.json({ currency });
  } catch (err) { handleServiceError(res, err); }
});

module.exports = router;
