const express = require('express');

const affiliateOpsRoutes = require('../modules/affiliate-ops/routes');
const googleAdsRoutes = require('../modules/google-ads/routes');
const aiAdvisorRoutes = require('../modules/ai-advisor/routes');
const monitoringRoutes = require('../modules/monitoring/routes');
const discoveryRoutes = require('../modules/discovery/routes');
const marketIntelRoutes = require('../modules/market-intel/routes');
const competitiveIntelRoutes = require('../modules/competitive-intel/routes');
const usersRoutes = require('../modules/users/routes');
const decisionEngineRoutes = require('../modules/decision-engine/routes');

const router = express.Router();

// affiliate-ops expõe suas próprias rotas com prefixos variados (auth, affiliates,
// conversions, dashboard, r/:code) então monta direto na raiz da API.
router.use('/', affiliateOpsRoutes);

router.use('/campaigns', googleAdsRoutes);
router.use('/ai-advisor', aiAdvisorRoutes);
router.use('/monitoring', monitoringRoutes);
router.use('/products', discoveryRoutes);
router.use('/market-intel', marketIntelRoutes);
router.use('/competitive-intel', competitiveIntelRoutes);
router.use('/decision-engine', decisionEngineRoutes);

// Autenticação/gestão de EQUIPE interna (JWT + perfis, 2026-08-05) — prefixo
// /staff pra não colidir com /auth/login que affiliate-ops já usa pra afiliados
// (sistemas de login conceitualmente diferentes: afiliado que clica em link
// vs. equipe interna gerenciando a plataforma).
router.use('/staff', usersRoutes);

module.exports = router;
