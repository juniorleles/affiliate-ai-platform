const repo = require('./repository');
const googleAdsRepo = require('../google-ads/repository');
const { withContext } = require('../../shared/logger');

const log = withContext('monitoring');

// Queda de impressões maior que isso, comparando os últimos 3 dias com os 3
// anteriores, gera alerta. Simples de propósito (regra determinística, sem IA) —
// esse módulo precisa ser rápido e confiável, não "inteligente".
const IMPRESSION_DROP_THRESHOLD = 0.5; // 50%

async function checkCampaignStatusChanges() {
  const campaigns = await googleAdsRepo.listAllCampaigns();
  let alertsCreated = 0;

  for (const campaign of campaigns) {
    if (campaign.status === 'PAUSED') {
      const alreadyOpen = await repo.hasOpenAlert('campaign_paused', 'campaign', campaign.id);
      if (!alreadyOpen) {
        await repo.createAlert({
          type: 'campaign_paused',
          severity: 'high',
          subjectType: 'campaign',
          subjectId: campaign.id,
          message: `A campanha "${campaign.name}" está pausada no Google Ads.`,
        });
        alertsCreated++;
      }
    }
  }

  return alertsCreated;
}

async function checkImpressionDrops() {
  const campaigns = await googleAdsRepo.listAllCampaigns();
  let alertsCreated = 0;

  for (const campaign of campaigns) {
    const daily = await googleAdsRepo.getDailyMetrics(campaign.id);
    if (daily.length < 6) continue; // dado insuficiente pra comparar com confiança

    const last3 = daily.slice(-3);
    const previous3 = daily.slice(-6, -3);

    const sum = (arr) => arr.reduce((acc, d) => acc + Number(d.impressions), 0);
    const recentImpressions = sum(last3);
    const previousImpressions = sum(previous3);

    if (previousImpressions === 0) continue;

    const dropRatio = (previousImpressions - recentImpressions) / previousImpressions;
    if (dropRatio >= IMPRESSION_DROP_THRESHOLD) {
      const alreadyOpen = await repo.hasOpenAlert('impression_drop', 'campaign', campaign.id);
      if (!alreadyOpen) {
        await repo.createAlert({
          type: 'impression_drop',
          severity: 'medium',
          subjectType: 'campaign',
          subjectId: campaign.id,
          message: `Queda de ${Math.round(dropRatio * 100)}% nas impressões da campanha ` +
            `"${campaign.name}" nos últimos 3 dias, comparado aos 3 dias anteriores.`,
        });
        alertsCreated++;
      }
    }
  }

  return alertsCreated;
}

/**
 * Roda todas as verificações de monitoramento. Chamado pelo n8n (via rota interna)
 * ou pelo worker de fila (ver src/jobs/monitoring.worker.js).
 */
async function runAllChecks() {
  const statusAlerts = await checkCampaignStatusChanges();
  const impressionAlerts = await checkImpressionDrops();
  const total = statusAlerts + impressionAlerts;
  log.info(`Checagem concluída: ${total} alerta(s) novo(s).`);
  return { total, statusAlerts, impressionAlerts };
}

module.exports = {
  runAllChecks,
  listAlerts: repo.listAlerts,
  updateAlertStatus: repo.updateAlertStatus,
};
