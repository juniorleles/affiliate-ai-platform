const express = require('express');
const { requireAdmin, requireAffiliate } = require('../../shared/auth/middleware');
const service = require('./service');

const router = express.Router();

function handleServiceError(res, err) {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: err.message || 'Erro interno.' });
}

// --- Auth do afiliado ---
router.post('/auth/register', async (req, res) => {
  try {
    const result = await service.registerAffiliate(req.body);
    res.status(201).json(result);
  } catch (err) { handleServiceError(res, err); }
});

router.post('/auth/login', async (req, res) => {
  try {
    const result = await service.loginAffiliate(req.body);
    res.json(result);
  } catch (err) { handleServiceError(res, err); }
});

// --- Área do afiliado ---
router.get('/affiliates/me', requireAffiliate, async (req, res) => {
  try {
    const result = await service.getAffiliateProfile(req.affiliateId);
    res.json(result);
  } catch (err) { handleServiceError(res, err); }
});

// --- Admin ---
router.get('/affiliates', requireAdmin, async (req, res) => {
  try {
    const affiliates = await service.listAffiliatesWithStats(req.query);
    res.json({ affiliates });
  } catch (err) { handleServiceError(res, err); }
});

router.patch('/affiliates/:id', requireAdmin, async (req, res) => {
  try {
    const { status, commission_type, commission_value } = req.body;
    const affiliate = await service.updateAffiliate(req.params.id, {
      status, commissionType: commission_type, commissionValue: commission_value,
    });
    if (!affiliate) return res.status(404).json({ error: 'Afiliado não encontrado.' });
    res.json({ affiliate });
  } catch (err) { handleServiceError(res, err); }
});

// --- Rastreamento de clique (link público do afiliado) ---
router.get('/r/:code', async (req, res) => {
  try {
    const { dest, utm_source, utm_medium, utm_campaign, gclid } = req.query;
    const result = await service.registerClick({
      code: req.params.code,
      dest, utmSource: utm_source, utmMedium: utm_medium, utmCampaign: utm_campaign, gclid,
      ip: req.ip, userAgent: req.headers['user-agent'] || null,
    });

    if (!result) return res.status(404).send('Link de afiliado inválido ou inativo.');

    res.cookie('aff_ref', req.params.code, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' });
    res.redirect(302, result.destination);
  } catch (err) { handleServiceError(res, err); }
});

// --- Conversões ---
router.post('/conversions', async (req, res) => {
  try {
    const { referral_code, order_ref, value } = req.body;
    const code = referral_code || req.cookies?.aff_ref;
    const conversion = await service.registerConversion({ referralCode: code, orderRef: order_ref, value });
    res.status(201).json({ conversion });
  } catch (err) { handleServiceError(res, err); }
});

router.patch('/conversions/:id', requireAdmin, async (req, res) => {
  try {
    const allowed = ['pending', 'approved', 'paid', 'rejected'];
    if (!allowed.includes(req.body.status)) {
      return res.status(400).json({ error: `status deve ser um de: ${allowed.join(', ')}` });
    }
    const conversion = await service.updateConversionStatus(req.params.id, req.body.status);
    if (!conversion) return res.status(404).json({ error: 'Conversão não encontrada.' });
    res.json({ conversion });
  } catch (err) { handleServiceError(res, err); }
});

// --- Dashboard ---
router.get('/dashboard/summary', requireAdmin, async (req, res) => {
  try {
    const totals = await service.getDashboardTotals();
    const conversionRate = totals.total_clicks > 0
      ? Math.round((totals.total_conversions / totals.total_clicks) * 10000) / 100
      : 0;
    const recentActivity = await service.getRecentActivity();
    res.json({ totals: { ...totals, conversion_rate: conversionRate }, recentActivity });
  } catch (err) { handleServiceError(res, err); }
});

module.exports = router;
