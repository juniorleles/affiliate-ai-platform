// MÓDULO: discovery — rotas
// Descoberta automática removida do escopo (ver service.js) — cadastro
// manual é o único caminho.

const express = require('express');
const { requireAdmin } = require('../../shared/auth/middleware');
const repo = require('./repository');
const service = require('./service');
const lpAudit = require('./lpAudit');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  const products = await repo.listProducts(req.query);
  res.json({ products });
});

router.post('/manual', requireAdmin, async (req, res) => {
  try {
    const result = await service.addManualProduct(req.body);
    res.status(201).json(result);
  } catch (err) {
    console.error('Erro ao cadastrar produto manualmente:', err);
    res.status(400).json({ error: err.message || 'Falha ao cadastrar produto.' });
  }
});

// Body: { products: [ {networkType, externalId, name, commissionValue, ...}, ... ], minCommission? }
router.post('/manual/bulk', requireAdmin, async (req, res) => {
  try {
    const { products, minCommission } = req.body || {};
    const result = await service.addManualProductsBulk(products, { minCommission });
    res.status(201).json(result);
  } catch (err) {
    console.error('Erro ao cadastrar produtos em lote:', err);
    res.status(400).json({ error: err.message || 'Falha ao cadastrar produtos.' });
  }
});

// Fase 3d, Camada A — Auditor de LP avançado (texto + PageSpeed, sem visão).
// Body opcional: { adInfo: {headline, description, cta}, targetInfo: {publicoAlvo, pais, keywordPrincipal, keywordsSecundarias} }
router.post('/:productId/lp-audit/advanced', requireAdmin, async (req, res) => {
  try {
    const product = await repo.findProductById(req.params.productId);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });

    const { adInfo, targetInfo } = req.body || {};
    const result = await lpAudit.runAdvancedAuditTextOnly(product, { adInfo, targetInfo });
    res.json(result);
  } catch (err) {
    console.error('Erro na auditoria avançada de LP:', err);
    res.status(502).json({ error: err.message || 'Falha ao rodar a auditoria avançada.' });
  }
});

router.get('/:productId/lp-audit/advanced', requireAdmin, async (req, res) => {
  const audit = await lpAudit.getLatestAdvancedAudit(req.params.productId);
  res.json({ audit });
});

// Fase 3d, Camada B — análise visual via screenshot (desktop + mobile).
router.post('/:productId/lp-audit/visual', requireAdmin, async (req, res) => {
  try {
    const product = await repo.findProductById(req.params.productId);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });

    const result = await lpAudit.runAdvancedAuditVisual(product);
    res.json(result);
  } catch (err) {
    console.error('Erro na auditoria visual de LP:', err);
    res.status(502).json({ error: err.message || 'Falha ao rodar a auditoria visual.' });
  }
});

module.exports = router;
