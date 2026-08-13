const discoveryRepo = require('../discovery/repository');
const marketIntelRepo = require('../market-intel/repository');
const googleAdsRepo = require('../google-ads/repository');
const googleAdsService = require('../google-ads/service');
const { fetchAccountCurrency } = require('../google-ads/googleAdsClient');
const fx = require('../../shared/fx');
const decisionRepo = require('./repository');
const {
  computeOpportunityScore, computeConfidenceScore, decide, shouldStopPipeline,
  demandScoreFromSearches, economicsMarginFromStatus, complianceScoreFromSensitivity,
  bestCommercialKeywordRatio, applyVslPenalty,
} = require('./scoring');

/**
 * Converte o bid de leilão (vem na moeda da CONTA do Google Ads) pra moeda do
 * PRODUTO, antes de comparar com `cpc_maximo_calculado` — sem isso é o mesmo
 * bug de moeda já corrigido uma vez na Fase 2b (2026-08-04), e que
 * reapareceu aqui de novo por eu não ter aplicado a mesma proteção no
 * Decision Engine (achado real, 2026-08-06, testando com dado real: o bid em
 * BRL comparado direto contra o teto em EUR deixava o ratio artificialmente
 * baixo, quase não resgatando o produto).
 */
async function convertKeywordBidsToProductCurrency(keywordMetrics, productCurrency) {
  const accountCurrency = await fetchAccountCurrency();
  if (!accountCurrency || accountCurrency === productCurrency) return keywordMetrics;

  const rate = fx.getFxRate(productCurrency, accountCurrency);
  return keywordMetrics.map(k => ({
    ...k,
    top_of_page_bid_low: k.top_of_page_bid_low != null ? Number(k.top_of_page_bid_low) / rate : null,
    top_of_page_bid_high: k.top_of_page_bid_high != null ? Number(k.top_of_page_bid_high) / rate : null,
  }));
}

/**
 * Avalia (ou reavalia) um produto pelo Evidence Engine + Decision Engine.
 * Idempotente: só chama API externa (Keyword Planner) se a etapa
 * correspondente ainda não tiver rodado pra esse produto — reaproveita
 * keyword_metrics.research_source pra saber o que já foi feito.
 *
 * Pipeline: Economics+Compliance (sempre já existe, lido só) -> Keyword
 * genérico -> Keyword comercial -> decide. Para assim que uma decisão
 * confiável (testar/descartar) for possível — nunca gasta cota à toa.
 */
async function evaluateProduct(productId) {
  const product = await discoveryRepo.findProductById(productId);
  if (!product) throw Object.assign(new Error('Produto não encontrado.'), { status: 404 });

  let economics = await marketIntelRepo.getLatestEconomics(productId);
  const compliance = await discoveryRepo.getLatestCompliance(productId);

  const evidence = {
    hasEconomicsCompliance: !!(economics || compliance),
    hasGenericKeyword: false,
    hasCommercialIntent: false,
    hasLpCamadaA: false,
    hasLpCamadaB: false,
    hasCompetitiveData: false,
  };
  const signals = {
    economicsMarginRatio: null,
    demandScore: null,
    commercialKeywordRatio: null,
    lpQualityScore: null,
    complianceScore: complianceScoreFromSensitivity(compliance?.niche_sensitivity),
  };

  const evaluateAndMaybeStop = (stage) => {
    let opportunity = computeOpportunityScore(signals);
    // Penalidade de VSL (2026-08-07, pedido do usuário — regra trazida de fora
    // do sistema, mapa mental de qualificação de produto). Ver scoring.js
    // pra detalhe/motivo — aqui só aplica.
    opportunity = applyVslPenalty(opportunity, hasVsl);
    const confidence = computeConfidenceScore(evidence);
    const decision = decide({
      opportunity, confidence,
      economicsStatus: economics?.status,
      nicheSensitivity: compliance?.niche_sensitivity,
    });
    return { opportunity, confidence, decision, stage };
  };

  // Checagem oportunista de Auditoria de LP (2026-08-07) — não dispara
  // auditoria nova (isso continua fora do pipeline ativo, por escopo já
  // definido no núcleo do Decision Engine). Só aproveita o que já existe: se
  // alguém já rodou a Auditoria de LP pra esse produto em algum momento
  // (fluxo manual, Fase 3d), usa esse dado real — nunca inventa.
  const lpAudit = await discoveryRepo.getLatestLpAudit(productId);
  const hasVsl = !!lpAudit?.has_vsl;
  if (lpAudit) {
    evidence.hasLpCamadaA = lpAudit.analysis_tier === 'camada_a' || lpAudit.analysis_tier === 'camada_b';
    evidence.hasLpCamadaB = lpAudit.analysis_tier === 'camada_b';
    signals.lpQualityScore = lpAudit.conversion_score ?? lpAudit.offer_clarity_score ?? null;
  }

  // Etapa 0 — Economics + Compliance (já calculados no cadastro, só lê)
  let result = evaluateAndMaybeStop('economics_compliance');
  if (shouldStopPipeline(result.decision)) return persist(productId, result, signals);

  // Etapa 1 — Keyword genérico (idempotente: só chama API se nunca rodou)
  const jaTemGenerico = await googleAdsRepo.hasKeywordResearchSource(productId, 'generic');
  if (!jaTemGenerico) {
    await googleAdsService.researchKeywordsForProduct(productId, {});
  }
  economics = await marketIntelRepo.getLatestEconomics(productId); // releitura pós-recalculo
  let keywordMetrics = await googleAdsRepo.getLatestKeywordMetrics(productId);
  const genericos = keywordMetrics.filter(k => k.research_source === 'generic');
  const melhorGenerico = genericos.sort((a, b) => (Number(b.avg_monthly_searches) || 0) - (Number(a.avg_monthly_searches) || 0))[0];

  evidence.hasGenericKeyword = true;
  signals.economicsMarginRatio = economicsMarginFromStatus(economics?.status);
  signals.demandScore = demandScoreFromSearches(melhorGenerico?.avg_monthly_searches);

  result = evaluateAndMaybeStop('keyword_generico');
  if (shouldStopPipeline(result.decision)) return persist(productId, result, signals);

  // Etapa 2 — Keyword de intenção comercial (idempotente também)
  const jaTemComercial = await googleAdsRepo.hasKeywordResearchSource(productId, 'commercial_intent');
  if (!jaTemComercial) {
    await googleAdsService.researchCommercialIntentKeywords(productId, {});
    keywordMetrics = await googleAdsRepo.getLatestKeywordMetrics(productId);
  }

  evidence.hasCommercialIntent = true;
  const keywordMetricsConvertidas = await convertKeywordBidsToProductCurrency(keywordMetrics, product.currency || 'EUR');
  signals.commercialKeywordRatio = bestCommercialKeywordRatio(keywordMetricsConvertidas, economics?.cpc_maximo_calculado);

  result = evaluateAndMaybeStop('keyword_comercial');
  // Chegou no fim do pipeline (por ora — LP/concorrência entram depois,
  // fora de escopo desta etapa por pedido explícito). Se ainda for
  // "investigar" aqui, é resultado final mesmo — não tem mais evidência
  // barata pra coletar dentro do escopo atual.
  return persist(productId, result, signals);
}

async function persist(productId, { opportunity, confidence, decision, stage }, signals) {
  const saved = await decisionRepo.saveDecision(productId, {
    opportunityScore: opportunity ?? 0, // NOT NULL no banco — null só ocorre com zero evidência, caso raro
    confidenceScore: confidence ?? 0,
    decisionStatus: decision.status,
    evidenceStage: stage,
    stoppedReason: decision.reason,
    demandScore: signals.demandScore,
    reasoning: `Parado na etapa "${stage}" — motivo: ${decision.reason}.`,
  });
  return {
    productId,
    opportunityScore: opportunity,
    confidenceScore: confidence,
    decisionStatus: decision.status,
    stoppedReason: decision.reason,
    evidenceStage: stage,
    savedRecordId: saved.id,
  };
}

async function getLatestDecision(productId) {
  return decisionRepo.getLatestDecision(productId);
}

module.exports = { evaluateProduct, getLatestDecision };
