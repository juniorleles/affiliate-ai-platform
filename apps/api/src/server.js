require('./shared/env');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const apiRoutes = require('./routes');
const { withContext } = require('./shared/logger');

const log = withContext('server');
const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use('/api', apiRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log.info(`API rodando em http://localhost:${PORT}`);
  log.info(`Health check: http://localhost:${PORT}/health`);
  log.info('Front-end (React) roda separado — ver apps/web (npm run dev:web).');
  log.info('Workers de fila rodam em processo separado — ver apps/api (npm run worker).');
});

// Sincronização/análise/monitoramento automáticos, opcional (fallback simples caso
// o n8n ainda não esteja configurado — ver docs/ARQUITETURA.md seção 5).
if (process.env.ENABLE_INTERNAL_SCHEDULER === 'true') {
  const { googleAdsSyncQueue, campaignAnalysisQueue, monitoringQueue } = require('./shared/queue/queues');

  log.info('Scheduler interno ATIVADO (a cada 24h para sync/análise, 15min para monitoramento).');

  const runDailyPipeline = async () => {
    await googleAdsSyncQueue.add('daily-sync', {});
    await campaignAnalysisQueue.add('daily-analysis', {});
  };
  runDailyPipeline();
  setInterval(runDailyPipeline, 24 * 60 * 60 * 1000);

  const runMonitoring = () => monitoringQueue.add('scheduled-check', {});
  runMonitoring();
  setInterval(runMonitoring, 15 * 60 * 1000);
}

module.exports = app;
