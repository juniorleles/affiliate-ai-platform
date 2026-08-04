const express = require('express');

const affiliateOpsRoutes = require('../modules/affiliate-ops/routes');
const googleAdsRoutes = require('../modules/google-ads/routes');
const aiAdvisorRoutes = require('../modules/ai-advisor/routes');
const monitoringRoutes = require('../modules/monitoring/routes');
const discoveryRoutes = require('../modules/discovery/routes');
const marketIntelRoutes = require('../modules/market-intel/routes');
const competitiveIntelRoutes = require('../modules/competitive-intel/routes');

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

module.exports = router;
