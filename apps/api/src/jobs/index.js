require('../shared/env');

// Processo separado da API HTTP, de propósito — workers processam trabalho pesado/
// assíncrono (chamadas de IA, sync com APIs externas) e não devem competir por
// recursos com quem está respondendo requisição do usuário. Rodar com `npm run worker`.

require('./googleAdsSync.worker');
require('./campaignAnalysis.worker');
require('./monitoring.worker');

// Workers dos módulos futuros entram aqui conforme as Fases 2-4 forem implementadas:
// require('./discoverySync.worker');
// require('./marketIntelScore.worker');
// require('./competitiveIntelScan.worker');

console.log('Workers no ar: google-ads-sync, campaign-analysis, monitoring-check.');
