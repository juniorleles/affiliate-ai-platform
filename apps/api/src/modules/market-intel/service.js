// MÓDULO: market-intel (Módulo 2 do documento original)
// Status: economics.js (5.1) e scoreProduct (Fase 3b) implementados e testados.

const marketIntelRepo = require('./repository');
const discoveryRepo = require('../discovery/repository');
const googleAdsService = require('../google-ads/service');
const aiAdvisor = require('../ai-advisor/service');
const scoring = require('./scoring');
const { evaluateEconomics, estimateRoi } = require('./economics');

/**
 * Calcula o score determinístico de um produto e, na sequência, chama a IA
 * pra responder as 8 perguntas originais do documento (Módulo 4), com
 * Economics + Keyword + Compliance + Auditoria de LP já como fatos no
 * contexto — não estimados do zero pela IA.
 *
 * Pula a chamada de IA quando o motivo da rejeição é trivial
 * (rejeitado_por_comissao_minima) — não precisa de julgamento qualitativo
 * pra confirmar que comissão baixa demais não compensa. Continua chamando a
 * IA para rejeitado_por_economics, que é um caso de borda que vale julgamento
 * (pode haver keyword alternativa mais barata).
 */
async function scoreProduct(productId) {
  const product = await discoveryRepo.findProductById(productId);
  if (!product) throw Object.assign(new Error('Produto não encontrado.'), { status: 404 });

  const economics = await marketIntelRepo.getLatestEconomics(productId);
  const keywordMetrics = await googleAdsService.getKeywordMetrics(productId);
  const compliance = await discoveryRepo.getLatestCompliance(productId);
  const lpAudit = await discoveryRepo.getLatestLpAudit(productId);

  const primaryKeyword = (keywordMetrics || [])
    .slice()
    .sort((a, b) => (Number(b.avg_monthly_searches) || 0) - (Number(a.avg_monthly_searches) || 0))[0] || null;

  const demandScore = scoring.computeDemandScore(primaryKeyword?.avg_monthly_searches ?? null);
  const competitionScore = scoring.computeCompetitionScore(
    primaryKeyword?.competition_level ?? null,
    primaryKeyword?.competition_index ?? null
  );
  const economicsScore = scoring.computeEconomicsScore(economics?.status ?? null);
  const lpQualityScore = scoring.computeLpQualityScore({
    hasCta: lpAudit?.has_cta, hasVsl: lpAudit?.has_vsl, affiliateParamsPreserved: lpAudit?.affiliate_params_preserved,
  });

  const overallScore = scoring.computeOverallScore({
    demand: demandScore, competition: competitionScore, economics: economicsScore, lpQuality: lpQualityScore,
  });

  const scoreRow = await marketIntelRepo.insertOpportunityScore(productId, {
    score: overallScore,
    demandScore,
    competitionScore,
    trendScore: null,
    seasonalityScore: null,
    salesPageQualityScore: lpQualityScore,
    reasoning: 'Score determinístico: demanda e competição vêm da keyword de maior volume ' +
      'já pesquisada (5.2); economics vem do status mais recente (5.1); qualidade de LP vem ' +
      'da auditoria manual (5.4). trend_score e seasonality_score não calculados — sem fonte ' +
      'de dado de tendência integrada ainda.',
    modelVersion: 'deterministic-v1',
  });

  if (economics?.status === 'rejeitado_por_comissao_minima') {
    return {
      score: scoreRow,
      aiAnalysis: null,
      skippedAiReason: 'rejeitado_por_comissao_minima — comissão abaixo do mínimo configurado, ' +
        'não precisa de julgamento qualitativo pra confirmar que não compensa.',
    };
  }

  const aiAnalysis = await aiAdvisor.evaluateProductOpportunity({
    productId, product, economics, keywordMetrics, compliance, lpAudit, deterministicScore: scoreRow,
  });

  return { score: scoreRow, aiAnalysis };
}

async function getLatestScore(productId) {
  return marketIntelRepo.getLatestScore(productId);
}

module.exports = { scoreProduct, getLatestScore, evaluateEconomics, estimateRoi };
