const { Worker } = require('bullmq');
const connection = require('../shared/queue/connection');
const monitoringService = require('../modules/monitoring/service');
const { withContext } = require('../shared/logger');

const log = withContext('worker:monitoring-check');

const worker = new Worker('monitoring-check', async () => {
  const result = await monitoringService.runAllChecks();
  log.info(`Checagem concluída: ${result.total} alerta(s) novo(s).`);
  return result;
}, { connection });

worker.on('failed', (job, err) => log.error(`Job ${job?.id} falhou`, { error: err.message }));

module.exports = worker;
