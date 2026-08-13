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
//
// Desacoplado em 2 flags (2026-08-05, decisão do usuário): monitoramento (leitura +
// comparação, ZERO custo de IA) e sync+análise diária (leitura + IA, custo real e
// recorrente) tinham 1 flag só antes — misturava "seguro pra ligar sem pensar" com
// "precisa de teto de gasto que ainda não existe". Nenhum teto de gasto de IA foi
// implementado ainda (diferente do orçamento de campanha, que tem
// MAX_DAILY_BUDGET_HARD_CAP) — por isso ENABLE_INTERNAL_SCHEDULER_ANALYSIS continua
// desligado por padrão até isso ser medido/decidido com dado real de custo.
if (process.env.ENABLE_INTERNAL_SCHEDULER_MONITORING === 'true') {
  const { monitoringQueue } = require('./shared/queue/queues');
  log.info('Scheduler de monitoramento ATIVADO (a cada 15min) — zero custo de IA, só leitura + comparação.');

  const runMonitoring = () => monitoringQueue.add('scheduled-check', {});
  runMonitoring();
  setInterval(runMonitoring, 15 * 60 * 1000);
}

if (process.env.ENABLE_INTERNAL_SCHEDULER_ANALYSIS === 'true') {
  const { googleAdsSyncQueue, campaignAnalysisQueue } = require('./shared/queue/queues');
  log.info('Scheduler de sync+análise ATIVADO (a cada 24h) — inclui chamada de IA recorrente, custo real. Sem teto de gasto configurado ainda.');

  const runDailyPipeline = async () => {
    await googleAdsSyncQueue.add('daily-sync', {});
    await campaignAnalysisQueue.add('daily-analysis', {});
  };
  runDailyPipeline();
  setInterval(runDailyPipeline, 24 * 60 * 60 * 1000);
}

// Retrocompatibilidade: a flag antiga (única) ligava os dois juntos. Se alguém
// ainda tiver ENABLE_INTERNAL_SCHEDULER=true no .env, avisa em vez de simplesmente
// não fazer nada — melhor um log explícito do que um scheduler "sumindo" sem explicação.
if (process.env.ENABLE_INTERNAL_SCHEDULER === 'true'
  && process.env.ENABLE_INTERNAL_SCHEDULER_MONITORING !== 'true'
  && process.env.ENABLE_INTERNAL_SCHEDULER_ANALYSIS !== 'true') {
  log.warn('ENABLE_INTERNAL_SCHEDULER está definida mas foi substituída por 2 flags separadas (2026-08-05) — use ENABLE_INTERNAL_SCHEDULER_MONITORING e/ou ENABLE_INTERNAL_SCHEDULER_ANALYSIS no .env. Nenhum scheduler foi ligado agora.');
}

module.exports = app;
