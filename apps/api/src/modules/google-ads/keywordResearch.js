/**
 * Pesquisa de palavra-chave e leilão (docs/ARQUITETURA.md, seção 5.2).
 *
 * Usa uma API do Google Ads DIFERENTE da que já usamos na Fase 1 (aquela lê o
 * recurso `campaign` via query(); esta usa o Keyword Plan Idea Service, que
 * não depende de haver campanha rodando — é pesquisa prévia, exige nível de
 * acesso Basic/Standard, já confirmado disponível na sua conta).
 *
 * Mesma ressalva do connector Digistore24: a lib google-ads-api não documenta
 * o shape exato da resposta de generateKeywordIdeas tão bem quanto o de
 * query(). Parsing defensivo — na primeira chamada real, confira o console
 * por avisos "[keyword-research]" e ajuste normalizeIdea() abaixo se os
 * números vierem null onde não deveriam.
 */

const { GoogleAdsApi, services } = require('google-ads-api');

function getCustomer() {
  const requiredVars = [
    'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID',
  ];
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length) {
    throw new Error(`Credenciais do Google Ads ausentes no .env: ${missing.join(', ')}`);
  }

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  return client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });
}

const COMPETITION_MAP = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' };

function normalizeIdea(idea) {
  const metrics = idea.keyword_idea_metrics || idea.keywordIdeaMetrics || {};
  const competitionRaw = metrics.competition;
  const competitionLevel = typeof competitionRaw === 'string' ? (COMPETITION_MAP[competitionRaw] ?? null) : null;

  return {
    keywordText: idea.text ?? idea.keyword_text ?? null,
    avgMonthlySearches: metrics.avg_monthly_searches ?? metrics.avgMonthlySearches ?? null,
    competitionLevel,
    competitionIndex: metrics.competition_index ?? metrics.competitionIndex ?? null,
    topOfPageBidLow: metrics.low_top_of_page_bid_micros != null
      ? Number(metrics.low_top_of_page_bid_micros) / 1000000 : null,
    topOfPageBidHigh: metrics.high_top_of_page_bid_micros != null
      ? Number(metrics.high_top_of_page_bid_micros) / 1000000 : null,
  };
}

async function fetchKeywordIdeas({ seedKeyword, locationIds, languageId, pageSize = 20 }) {
  if (!seedKeyword) throw new Error('seedKeyword é obrigatório.');

  const customer = getCustomer();
  const keywordSeed = new services.KeywordSeed({ keywords: [seedKeyword] });

  const requestPayload = {
    customer_id: customer.credentials.customer_id,
    page_size: pageSize,
    keyword_seed: keywordSeed,
  };
  if (languageId) requestPayload.language = 'languageConstants/' + languageId;
  if (locationIds && locationIds.length) {
    requestPayload.geo_target_constants = locationIds.map(function (id) { return 'geoTargetConstants/' + id; });
  }

  const response = await customer.keywordPlanIdeas.generateKeywordIdeas(requestPayload);
  const results = (response && response.results) || response || [];

  if (!Array.isArray(results) || results.length === 0) {
    console.warn('[keyword-research] Nenhum resultado retornado. Resposta bruta (primeiros 500 chars):',
      JSON.stringify(response).slice(0, 500));
    return [];
  }

  const normalized = results.map(normalizeIdea).filter(function (k) { return k.keywordText; });
  if (normalized.some(function (k) { return k.topOfPageBidLow == null && k.topOfPageBidHigh == null; })) {
    console.warn('[keyword-research] Alguns resultados vieram sem dado de bid — confira o shape real da resposta e ajuste normalizeIdea() se for recorrente.');
  }

  return normalized;
}

module.exports = { fetchKeywordIdeas };
