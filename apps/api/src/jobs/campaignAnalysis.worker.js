const { Worker } = require('bullmq');
const connection = require('../shared/queue/connection');
const googleAdsService = require('../modules/google-ads/service');
const { withContext } = require('../shared/logger');

const log = withContext('worker:campaign-analysis');

const worker = new Worker('campaign-analysis', async (job) => {
  const { campaignId } = job.data;

  if (campaignId) {
    const analysis = await googleAdsService.analyzeCampaign(campaignId);
    log.info(`Campanha ${campaignId} analisada → ${analysis.verdict}`);
    return analysis;
  }

  // Sem campaignId específico: analisa todas as campanhas com dados sincronizados
  const campaigns = await googleAdsService.listAllCampaigns();
  const results = [];
  for (const campaign of campaigns) {
    try {
      const analysis = await googleAdsService.analyzeCampaign(campaign.id);
      log.info(`Campanha "${campaign.name}" analisada → ${analysis.verdict}`);
      results.push({ campaignId: campaign.id, verdict: analysis.verdict });
    } catch (err) {
      log.warn(`Pulei "${campaign.name}": ${err.message}`);
    }
  }
  return { analyzed: results.length };
}, { connection });

worker.on('failed', (job, err) => log.error(`Job ${job?.id} falhou`, { error: err.message }));

module.exports = worker;
