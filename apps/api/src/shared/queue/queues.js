const { Queue } = require('bullmq');
const connection = require('./connection');

// Uma fila por tipo de trabalho pesado/assíncrono. Adicionar aqui conforme os
// módulos das próximas fases (discovery, market-intel, competitive-intel) forem
// implementados de verdade — ver docs/ARQUITETURA.md seção 5 para o fluxo completo.
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

const googleAdsSyncQueue = new Queue('google-ads-sync', { connection, defaultJobOptions });
const campaignAnalysisQueue = new Queue('campaign-analysis', { connection, defaultJobOptions });
const monitoringQueue = new Queue('monitoring-check', { connection, defaultJobOptions });

// Filas dos módulos futuros já nomeadas para manter o padrão consistente com
// docs/ARQUITETURA.md — os workers correspondentes ainda não existem (ver src/jobs).
const discoverySyncQueue = new Queue('discovery-sync', { connection, defaultJobOptions });
const marketIntelScoreQueue = new Queue('market-intel-score', { connection, defaultJobOptions });
const competitiveIntelScanQueue = new Queue('competitive-intel-scan', { connection, defaultJobOptions });

module.exports = {
  googleAdsSyncQueue,
  campaignAnalysisQueue,
  monitoringQueue,
  discoverySyncQueue,
  marketIntelScoreQueue,
  competitiveIntelScanQueue,
};
