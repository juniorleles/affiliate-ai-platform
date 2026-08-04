const { Worker } = require('bullmq');
const connection = require('../shared/queue/connection');
const googleAdsService = require('../modules/google-ads/service');
const { withContext } = require('../shared/logger');

const log = withContext('worker:google-ads-sync');

const worker = new Worker('google-ads-sync', async () => {
  const count = await googleAdsService.syncCampaigns();
  log.info(`Sincronizados ${count} registros de métricas.`);
  return { synced: count };
}, { connection });

worker.on('failed', (job, err) => log.error(`Job ${job?.id} falhou`, { error: err.message }));

module.exports = worker;
