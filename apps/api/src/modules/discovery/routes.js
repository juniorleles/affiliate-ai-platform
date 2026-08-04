// MÓDULO: discovery — rotas
// Só a listagem já funciona (lê o que estiver no banco). A sincronização com as
// redes de afiliados entra na Fase 2 — ver service.js.

const express = require('express');
const { requireAdmin } = require('../../shared/auth/middleware');
const repo = require('./repository');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  const products = await repo.listProducts(req.query);
  res.json({ products });
});

router.post('/sync/:networkId', requireAdmin, async (req, res) => {
  res.status(501).json({
    error: 'Sincronização de redes de afiliados ainda não implementada (Fase 2). ' +
      'Ver docs/ARQUITETURA.md.',
  });
});

module.exports = router;
