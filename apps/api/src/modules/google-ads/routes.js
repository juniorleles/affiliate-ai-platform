const express = require('express');
const { requireAdmin } = require('../../shared/auth/middleware');
const service = require('./service');
const campaignDrafts = require('./campaignDrafts');
const aiAdvisor = require('../ai-advisor/service');

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

// Enriquece keyword_metrics com termo de fundo de funil (seeds de intenção
// comercial: "buy X", "X price", "X discount", etc.) — não recalcula Economics,
// só alimenta o pool que a Fase 6 usa pra montar rascunho de campanha.
// Body: { baseSeed?, modifiers? } — sem baseSeed, usa o nome do produto;
// sem modifiers, usa a lista padrão em inglês (buy/price/discount/coupon/where to buy).
router.post('/keyword-research/:productId/commercial-intent', requireAdmin, async (req, res) => {
  try {
    const { baseSeed, modifiers } = req.body || {};
    const result = await service.researchCommercialIntentKeywords(req.params.productId, { baseSeed, modifiers });
    res.json(result);
  } catch (err) { handleServiceError(res, err); }
});

// Utilitário: qual moeda a conta do Google Ads usa de verdade (não assumir).
router.get('/account-currency', requireAdmin, async (req, res) => {
  try {
    const currency = await service.getAccountCurrency();
    res.json({ currency });
  } catch (err) { handleServiceError(res, err); }
});

// Contas do Google Ads (Fase 7, suporte multi-conta)
router.get('/accounts', requireAdmin, async (req, res) => {
  const accounts = await service.listAccounts();
  res.json({ accounts });
});

router.post('/accounts', requireAdmin, async (req, res) => {
  try {
    const account = await service.addAccount(req.body);
    res.status(201).json({ account });
  } catch (err) { handleServiceError(res, err); }
});

router.delete('/accounts/:id', requireAdmin, async (req, res) => {
  try {
    const account = await service.removeAccount(req.params.id);
    res.json({ account });
  } catch (err) { handleServiceError(res, err); }
});

router.post('/accounts/refresh-status', requireAdmin, async (req, res) => {
  const results = await service.refreshAllAccountStatuses();
  res.json({ results });
});

// --- Governança "guarda-chuva" (2026-08-05) ---

router.get('/mccs', requireAdmin, async (req, res) => {
  const mccs = await service.listMccs();
  res.json({ mccs });
});

router.post('/mccs', requireAdmin, async (req, res) => {
  try {
    const mcc = await service.addMcc(req.body);
    res.status(201).json({ mcc });
  } catch (err) { handleServiceError(res, err); }
});

router.delete('/mccs/:id', requireAdmin, async (req, res) => {
  try {
    const mcc = await service.removeMcc(req.params.id);
    res.json({ mcc });
  } catch (err) { handleServiceError(res, err); }
});

// Descobre as contas reais sob a MCC via API do Google — responde a
// "como o sistema sabe quais contas existem?" (2026-08-06).
router.post('/mccs/:id/sync-accounts', requireAdmin, async (req, res) => {
  try {
    const result = await service.syncAccountsFromMcc(req.params.id);
    res.json(result);
  } catch (err) { handleServiceError(res, err); }
});

// Visão consolidada: contas agrupadas por MCC/operação/método de pagamento —
// pra enxergar "quantas contas dependem do mesmo cartão" sem contar na mão.
router.get('/governance/rollup', requireAdmin, async (req, res) => {
  const rollup = await service.getGovernanceRollup();
  res.json(rollup);
});

// --- Fase 6: rascunhos de campanha ---

router.post('/drafts', requireAdmin, async (req, res) => {
  try {
    const result = await campaignDrafts.createDraft(req.body);
    res.status(201).json(result);
  } catch (err) { handleServiceError(res, err); }
});

router.get('/drafts', requireAdmin, async (req, res) => {
  const drafts = await campaignDrafts.listDrafts();
  res.json({ drafts });
});

router.get('/drafts/:id', requireAdmin, async (req, res) => {
  const draft = await campaignDrafts.findDraftById(req.params.id);
  if (!draft) return res.status(404).json({ error: 'Rascunho não encontrado.' });
  res.json({ draft });
});

router.post('/drafts/:id/approve', requireAdmin, async (req, res) => {
  try {
    const draft = await campaignDrafts.approveDraft(req.params.id);
    res.json({ draft });
  } catch (err) { handleServiceError(res, err); }
});

// Bookkeeping manual: você criou a campanha de verdade no Google Ads (com as
// próprias mãos) usando este rascunho — marca aqui pra manter histórico.
// Não chama nenhuma API do Google (decisão de 2026-08-05).
router.post('/drafts/:id/mark-as-used', requireAdmin, async (req, res) => {
  try {
    const draft = await campaignDrafts.markAsUsed(req.params.id, req.body || {});
    res.json({ draft });
  } catch (err) { handleServiceError(res, err); }
});

// Texto formatado, pronto pra ler e digitar manualmente no Google Ads.
router.get('/drafts/:id/copy-text', requireAdmin, async (req, res) => {
  const draft = await campaignDrafts.findDraftById(req.params.id);
  if (!draft) return res.status(404).json({ error: 'Rascunho não encontrado.' });
  res.type('text/plain').send(campaignDrafts.formatDraftForCopy(draft));
});

// --- Fase 7, Parte A: revisão preventiva de compliance de anúncio ---
router.post('/drafts/:id/review-policy', requireAdmin, async (req, res) => {
  try {
    const draft = await campaignDrafts.findDraftById(req.params.id);
    if (!draft) return res.status(404).json({ error: 'Rascunho não encontrado.' });

    const headlines = Array.isArray(draft.headlines) ? draft.headlines : JSON.parse(draft.headlines || '[]');
    const descriptions = Array.isArray(draft.descriptions) ? draft.descriptions : JSON.parse(draft.descriptions || '[]');

    const result = await aiAdvisor.reviewAdPolicy({
      subjectId: draft.id,
      headline: headlines[0] || '',
      description: descriptions[0] || '',
      productContext: null,
    });
    res.json(result);
  } catch (err) { handleServiceError(res, err); }
});

module.exports = router;
