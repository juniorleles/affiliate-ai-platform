// MÓDULO: discovery — rotas

const express = require('express');
const { requireAdmin } = require('../../shared/auth/middleware');
const repo = require('./repository');
const service = require('./service');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  const products = await repo.listProducts(req.query);
  res.json({ products });
});

// POST /api/products/sync/digistore24  { searchTerm?, minCommission? }
router.post('/sync/:networkType', requireAdmin, async (req, res) => {
  try {
    const { searchTerm, minCommission } = req.body || {};
    const result = await service.syncNetwork(req.params.networkType, { searchTerm, minCommission });
    res.json(result);
  } catch (err) {
    console.error('Erro ao sincronizar rede de afiliados:', err);
    res.status(502).json({ error: err.message || 'Falha ao sincronizar rede de afiliados.' });
  }
});

// Cadastro manual de 1 produto — fallback enquanto a automação de uma rede não
// tem endpoint de listagem confirmado (ver docs/ARQUITETURA.md, Fase 2, nota
// sobre listMarketplaceEntries do Digistore24). Roda o mesmo pipeline de
// upsert + Economics que o sync automático rodaria.
// Body: { networkType, externalId, name, category?, price?, commissionType,
//         commissionValue, epc?, conversionRate, countriesAllowed?, salesPageUrl?, minCommission? }
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

module.exports = router;
