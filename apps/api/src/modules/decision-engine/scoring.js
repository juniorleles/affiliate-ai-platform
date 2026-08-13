/**
 * Núcleo do Evidence Engine + Decision Engine (2026-08-06). Funções puras —
 * sem SQL, sem chamada de IA, sem API externa. Mesmo princípio de
 * market-intel/scoring.js: "calculável primeiro". A orquestração (quando
 * chamar cada etapa) vive em service.js; aqui só a matemática da decisão.
 *
 * Ver docs/EVIDENCE_DECISION_ENGINE.md pro desenho completo e o porquê de
 * cada limiar.
 */

const OPPORTUNITY_WEIGHTS = {
  economicsMarginRatio: 0.30,
  demandScore: 0.20,
  commercialKeywordRatio: 0.25,
  lpQualityScore: 0.15,
  complianceScore: 0.10,
};

const CONFIDENCE_POINTS = {
  hasEconomicsCompliance: 20,
  hasGenericKeyword: 20,
  hasCommercialIntent: 25,
  hasLpCamadaA: 15,
  hasLpCamadaB: 10,
  hasCompetitiveData: 10,
};

const TESTAR_MIN = 60;
const DESCARTAR_MAX = 35;
const { classifyKeywordIntent } = require('../google-ads/keywordIntent');

const CONFIDENCE_MIN_PARA_DECIDIR = 60;

// Normaliza avg_monthly_searches (número aberto) pra 0-100 — mesmo teto usado
// aqui de forma simples e documentada: acima de 50k buscas/mês já é "demanda
// máxima" pro propósito desse score (não é ciência exata, é uma régua).
const DEMAND_SEARCHES_CEILING = 50000;

function demandScoreFromSearches(avgMonthlySearches) {
  if (avgMonthlySearches == null) return null;
  return Math.min(100, Math.round((Number(avgMonthlySearches) / DEMAND_SEARCHES_CEILING) * 100));
}

// Deriva um "quão folgada é a margem" (0-100) a partir do STATUS que o
// Economics já calculou com o leilão real — não recalcula nada, só traduz
// uma categoria já confiável (viavel/rejeitado_por_economics/dado_insuficiente)
// pra escala numérica que o Opportunity Score consegue ponderar.
function economicsMarginFromStatus(status) {
  if (status === 'viavel') return 90;
  if (status === 'rejeitado_por_economics') return 20;
  return null; // dado_insuficiente, erro_avaliacao — não inventa número
}

function complianceScoreFromSensitivity(nicheSensitivity) {
  if (nicheSensitivity === 'normal') return 100;
  if (nicheSensitivity === 'sensitive') return 60;
  return null; // black já é descarte imediato antes de chegar aqui; null = ainda não classificado
}

/**
 * Encontra, entre TODAS as keywords já coletadas (não importa se vieram da
 * busca genérica ou da comercial — `research_source` rastreia só de qual
 * CHAMADA a linha veio, não que INTENÇÃO ela expressa), a melhor candidata
 * com sinal de fundo de funil real e dado de leilão. É ela que "resgata" um
 * produto que a keyword genérica sozinha teria reprovado (item 11 do
 * desenho).
 *
 * Bug real corrigido em 2026-08-06, achado testando com dado real: a busca
 * genérica (seed = nome do produto) pode trazer, como "ideia relacionada",
 * um termo com intenção comercial de verdade (ex: "advanced amino formula
 * reviews" veio da busca GENÉRICA, não da comercial, mas tem sinal de
 * "review" — fundo de funil de verdade). Filtrar só por
 * `research_source === 'commercial_intent'` escondia esse resgate. Corrigido
 * usando `classifyKeywordIntent()` sobre o TEXTO da keyword, não sobre a
 * origem da busca.
 */
function bestCommercialKeywordRatio(keywordMetrics, cpcMaximoCalculado) {
  if (!cpcMaximoCalculado) return null;
  const comerciaisComBid = keywordMetrics.filter(
    k => k.top_of_page_bid_low != null && classifyKeywordIntent(k.keyword_text).stage === 'bottom'
  );
  if (comerciaisComBid.length === 0) return null;

  let melhorRatio = null;
  for (const k of comerciaisComBid) {
    const bidMedio = (Number(k.top_of_page_bid_low) + Number(k.top_of_page_bid_high || k.top_of_page_bid_low)) / 2;
    if (bidMedio <= 0) continue;
    const ratio = Math.min(100, Math.round((Number(cpcMaximoCalculado) / bidMedio) * 100));
    if (melhorRatio == null || ratio > melhorRatio) melhorRatio = ratio;
  }
  return melhorRatio;
}

/**
 * Opportunity Score (0-100) — média ponderada só dos sinais disponíveis.
 * Sinal ausente (null/undefined) é IGNORADO, nunca tratado como 0 nem
 * como neutro — o peso dele é redistribuído entre os sinais que existem.
 * Retorna null se nenhum sinal estiver disponível (nunca inventa número).
 */
function computeOpportunityScore(signals = {}) {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(OPPORTUNITY_WEIGHTS)) {
    const value = signals[key];
    if (value == null) continue;
    weightedSum += value * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;
  return Math.round(weightedSum / totalWeight);
}

/**
 * Confidence Score (0-100) — soma de pontos por etapa EFETIVAMENTE concluída
 * com dado real. Não mede "quão bom é o resultado", mede "quanto já foi
 * checado". Uma etapa que não rodou simplesmente não soma ponto — não há
 * penalidade por ausência, só ausência de crédito.
 */
function computeConfidenceScore(completedStages = {}) {
  let score = 0;
  for (const [key, points] of Object.entries(CONFIDENCE_POINTS)) {
    if (completedStages[key]) score += points;
  }
  return Math.min(100, score);
}

/**
 * Regra de decisão — nunca decide com só 1 dos 2 scores. Ordem importa:
 * descarte imediato primeiro (fato determinístico, não precisa de mais
 * evidência pra saber), depois a matriz Opportunity x Confidence.
 */
function decide({ opportunity, confidence, economicsStatus, nicheSensitivity }) {
  if (economicsStatus === 'rejeitado_por_comissao_minima') {
    return { status: 'descartar', reason: 'comissao_abaixo_do_minimo' };
  }
  if (nicheSensitivity === 'black') {
    return { status: 'descartar', reason: 'nicho_black' };
  }

  if (opportunity == null || confidence == null) {
    return { status: 'investigar', reason: 'dados_insuficientes' };
  }

  if (confidence < CONFIDENCE_MIN_PARA_DECIDIR) {
    return { status: 'investigar', reason: 'confianca_insuficiente' };
  }

  if (opportunity >= TESTAR_MIN) {
    return { status: 'testar', reason: 'oportunidade_e_confianca_altas' };
  }

  if (opportunity <= DESCARTAR_MAX) {
    return { status: 'descartar', reason: 'oportunidade_baixa_com_confianca_alta' };
  }

  return { status: 'investigar', reason: 'zona_cinzenta' };
}

/**
 * Critério de parada do pipeline (item 6 do desenho): já é possível decidir
 * com confiança (testar ou descartar por evidência), ou o descarte imediato
 * já resolveu tudo — nesses casos não vale a pena rodar mais etapa nenhuma.
 * `investigar` por falta de confiança NÃO para o pipeline — é o sinal de
 * "continue pra próxima etapa", desde que ainda exista uma.
 */
function shouldStopPipeline(decision) {
  return decision.status === 'testar' || decision.status === 'descartar';
}

/**
 * Penalidade de VSL (2026-08-07) — regra trazida de fora do sistema (mapa de
 * qualificação de produto do usuário): página com vídeo de vendas "aumenta
 * muito a fuga" numa estratégia de fundo de funil. Aplicada como penalidade
 * multiplicativa PÓS-cálculo do Opportunity Score, não como 6º peso na
 * fórmula — não mexe nos pesos já calibrados e validados com dado real
 * (Advanced Amino Formula). Só reduz, nunca aumenta; nunca aplica se
 * `opportunity` for null (sem inventar número onde não há evidência).
 */
const VSL_PENALTY_MULTIPLIER = 0.7; // -30%, valor inicial — calibrar com mais produtos reais depois

function applyVslPenalty(opportunity, hasVsl) {
  if (opportunity == null || !hasVsl) return opportunity;
  return Math.round(opportunity * VSL_PENALTY_MULTIPLIER);
}

module.exports = {
  computeOpportunityScore,
  computeConfidenceScore,
  decide,
  shouldStopPipeline,
  demandScoreFromSearches,
  economicsMarginFromStatus,
  complianceScoreFromSensitivity,
  bestCommercialKeywordRatio,
  applyVslPenalty,
  VSL_PENALTY_MULTIPLIER,
  OPPORTUNITY_WEIGHTS,
  CONFIDENCE_POINTS,
  TESTAR_MIN,
  DESCARTAR_MAX,
  CONFIDENCE_MIN_PARA_DECIDIR,
};
