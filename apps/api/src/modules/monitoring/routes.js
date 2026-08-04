const express = require('express');
const { requireAdmin, requireInternal } = require('../../shared/auth/middleware');
const service = require('./service');

const router = express.Router();

router.get('/alerts', requireAdmin, async (req, res) => {
  const alerts = await service.listAlerts(req.query);
  res.json({ alerts });
});

router.patch('/alerts/:id', requireAdmin, async (req, res) => {
  const allowed = ['open', 'ack', 'resolved'];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ error: `status deve ser um de: ${allowed.join(', ')}` });
  }
  const alert = await service.updateAlertStatus(req.params.id, req.body.status);
  if (!alert) return res.status(404).json({ error: 'Alerta não encontrado.' });
  res.json({ alert });
});

// Rota interna, chamada pelo n8n em intervalo curto (ex: a cada 15 min) — ver
// docs/ARQUITETURA.md seção 5.
router.post('/internal/check', requireInternal, async (req, res) => {
  try {
    const result = await service.runAllChecks();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao rodar checagem de monitoramento.' });
  }
});

module.exports = router;
