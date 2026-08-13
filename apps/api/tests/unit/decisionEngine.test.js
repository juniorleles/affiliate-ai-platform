const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeOpportunityScore, computeConfidenceScore, decide, shouldStopPipeline,
  bestCommercialKeywordRatio, applyVslPenalty,
} = require('../../src/modules/decision-engine/scoring');

// --- Cenário 1: Comissão abaixo do mínimo → DESCARTAR imediato ---
test('comissão abaixo do mínimo descarta imediatamente, sem olhar scores', () => {
  const decision = decide({
    opportunity: 90, confidence: 90, // mesmo com tudo "bom", a regra imediata manda
    economicsStatus: 'rejeitado_por_comissao_minima',
    nicheSensitivity: 'normal',
  });
  assert.equal(decision.status, 'descartar');
  assert.equal(decision.reason, 'comissao_abaixo_do_minimo');
});

// --- Cenário 2: Compliance black → DESCARTAR imediato ---
test('nicho black descarta imediatamente, sem olhar scores', () => {
  const decision = decide({
    opportunity: 90, confidence: 90,
    economicsStatus: 'viavel',
    nicheSensitivity: 'black',
  });
  assert.equal(decision.status, 'descartar');
  assert.equal(decision.reason, 'nicho_black');
});

// --- Cenário 3: Keyword genérica ruim + Confidence 40 → INVESTIGAR ---
test('keyword genérica ruim sozinha (confidence 40) nunca descarta — vira investigar', () => {
  const opportunity = computeOpportunityScore({
    economicsMarginRatio: 20, // rejeitado_por_economics
    complianceScore: 60,      // sensitive
  });
  const confidence = computeConfidenceScore({
    hasEconomicsCompliance: true,
    hasGenericKeyword: true,
  });
  assert.equal(confidence, 40);

  const decision = decide({ opportunity, confidence, economicsStatus: 'rejeitado_por_economics', nicheSensitivity: 'sensitive' });
  assert.equal(decision.status, 'investigar');
  assert.equal(decision.reason, 'confianca_insuficiente');
});

// --- Cenário 4: Keyword genérica ruim + Commercial Intent viável → TESTAR ---
test('keyword comercial viável resgata produto que a genérica sozinha reprovaria', () => {
  const opportunity = computeOpportunityScore({
    economicsMarginRatio: 20,     // genérica ruim
    demandScore: 70,
    commercialKeywordRatio: 100,  // comercial muito viável, bem dentro do teto
    complianceScore: 60,
  });
  assert.equal(opportunity, 60); // valor exato da fórmula, calculado
  const confidence = computeConfidenceScore({
    hasEconomicsCompliance: true,
    hasGenericKeyword: true,
    hasCommercialIntent: true,
  });
  assert.equal(confidence, 65);

  const decision = decide({ opportunity, confidence, economicsStatus: 'rejeitado_por_economics', nicheSensitivity: 'sensitive' });
  assert.equal(decision.status, 'testar');
});

// --- Cenário 5: Opportunity baixo + Confidence baixa → INVESTIGAR ---
test('opportunity baixo com confidence baixa não descarta, vira investigar', () => {
  const decision = decide({ opportunity: 15, confidence: 30, economicsStatus: 'rejeitado_por_economics', nicheSensitivity: 'normal' });
  assert.equal(decision.status, 'investigar');
  assert.equal(decision.reason, 'confianca_insuficiente');
});

// --- Cenário 6: Opportunity baixo + Confidence >= 60 → DESCARTAR ---
test('opportunity baixo com confidence alta descarta por evidência acumulada', () => {
  const decision = decide({ opportunity: 30, confidence: 65, economicsStatus: 'rejeitado_por_economics', nicheSensitivity: 'normal' });
  assert.equal(decision.status, 'descartar');
  assert.equal(decision.reason, 'oportunidade_baixa_com_confianca_alta');
});

// --- Cenário 7: Opportunity intermediário + Confidence >= 60 → INVESTIGAR ---
test('zona cinzenta (opportunity 36-59, confidence alta) vira investigar, não decide sozinho', () => {
  const decision = decide({ opportunity: 45, confidence: 65, economicsStatus: 'viavel', nicheSensitivity: 'normal' });
  assert.equal(decision.status, 'investigar');
  assert.equal(decision.reason, 'zona_cinzenta');
});

// --- Cenário 8: Dados insuficientes → INVESTIGAR ---
test('dados insuficientes (scores null) sempre vira investigar, nunca testar/descartar', () => {
  const decision = decide({ opportunity: null, confidence: null, economicsStatus: 'dado_insuficiente', nicheSensitivity: null });
  assert.equal(decision.status, 'investigar');
  assert.equal(decision.reason, 'dados_insuficientes');
});

// shouldStopPipeline — usado pelo orquestrador pra saber se continua coletando
test('shouldStopPipeline só para em testar ou descartar, nunca em investigar', () => {
  assert.equal(shouldStopPipeline({ status: 'testar' }), true);
  assert.equal(shouldStopPipeline({ status: 'descartar' }), true);
  assert.equal(shouldStopPipeline({ status: 'investigar' }), false);
});

// --- applyVslPenalty: sinal trazido de fora do sistema (2026-08-07) ---
test('VSL reduz o Opportunity Score em 30%, arredondado', () => {
  assert.equal(applyVslPenalty(80, true), 56); // 80 * 0.7 = 56
  assert.equal(applyVslPenalty(100, true), 70);
});

test('sem VSL, o Opportunity Score não muda', () => {
  assert.equal(applyVslPenalty(80, false), 80);
  assert.equal(applyVslPenalty(80, undefined), 80);
});

test('VSL nunca inventa número quando opportunity ainda é null (sem evidência)', () => {
  assert.equal(applyVslPenalty(null, true), null);
});

// --- bestCommercialKeywordRatio: bug real corrigido em 2026-08-06 ---

test('keyword com sinal de fundo de funil conta mesmo vindo da busca genérica (bug real corrigido)', () => {
  // Reproduz exatamente o caso real: "advanced amino formula reviews" veio
  // da busca GENÉRICA (research_source='generic'), não da comercial, mas
  // tem sinal de "review" — deveria contar pro resgate mesmo assim.
  const keywordMetrics = [
    { keyword_text: 'amino acid supplement', research_source: 'generic', top_of_page_bid_low: null, top_of_page_bid_high: null },
    { keyword_text: 'advanced amino formula reviews', research_source: 'generic', top_of_page_bid_low: 1.5, top_of_page_bid_high: 2.0 },
    { keyword_text: 'buy advanced amino formula', research_source: 'commercial_intent', top_of_page_bid_low: null, top_of_page_bid_high: null },
  ];
  const ratio = bestCommercialKeywordRatio(keywordMetrics, 2.94);
  assert.ok(ratio != null, 'deveria ter encontrado a keyword de resgate, mesmo vinda da busca genérica');
  assert.ok(ratio >= 100, `esperava ratio alto (CPC máximo 2.94 vs bid médio 1.75), veio ${ratio}`);
});

test('keyword sem sinal de fundo de funil (mesmo com bid) não conta pro resgate', () => {
  const keywordMetrics = [
    { keyword_text: 'bcaa supplements', research_source: 'generic', top_of_page_bid_low: 0.27, top_of_page_bid_high: 0.35 },
  ];
  const ratio = bestCommercialKeywordRatio(keywordMetrics, 2.94);
  assert.equal(ratio, null, '"bcaa supplements" não tem sinal de fundo de funil — não deveria contar');
});
test('Advanced Amino Formula: genérico ruim evolui pra comercial viável = TESTAR (nunca descarta na etapa 1)', () => {
  // Etapa 1 — só genérico (amino acid supplement, leilão acima do teto)
  const opportunityEtapa1 = computeOpportunityScore({
    economicsMarginRatio: 20, // rejeitado_por_economics
    demandScore: 45,          // "amino acid supplement" tem volume razoável
    complianceScore: 60,      // sensitive
  });
  const confidenceEtapa1 = computeConfidenceScore({
    hasEconomicsCompliance: true,
    hasGenericKeyword: true,
  });
  assert.equal(opportunityEtapa1, 35); // valor exato da fórmula, calculado, não estimado
  assert.equal(confidenceEtapa1, 40);
  const decisionEtapa1 = decide({
    opportunity: opportunityEtapa1, confidence: confidenceEtapa1,
    economicsStatus: 'rejeitado_por_economics', nicheSensitivity: 'sensitive',
  });
  // O PONTO CENTRAL do cenário: mesmo com Opportunity baixo (35), a Confidence
  // (40) é baixa demais pra autorizar descarte — o pipeline É OBRIGADO a
  // continuar pra keyword comercial antes de decidir qualquer coisa.
  assert.equal(decisionEtapa1.status, 'investigar');
  assert.equal(decisionEtapa1.reason, 'confianca_insuficiente');

  // Etapa 2 — soma keyword comercial ("advanced amino formula reviews", CPC dentro do teto)
  const opportunityEtapa2 = computeOpportunityScore({
    economicsMarginRatio: 20,
    demandScore: 75,
    commercialKeywordRatio: 100, // reviews viável, bem dentro do teto
    complianceScore: 60,
  });
  const confidenceEtapa2 = computeConfidenceScore({
    hasEconomicsCompliance: true,
    hasGenericKeyword: true,
    hasCommercialIntent: true,
  });
  assert.equal(opportunityEtapa2, 61); // valor exato da fórmula, calculado
  assert.equal(confidenceEtapa2, 65);
  const decisionEtapa2 = decide({
    opportunity: opportunityEtapa2, confidence: confidenceEtapa2,
    economicsStatus: 'rejeitado_por_economics', nicheSensitivity: 'sensitive',
  });
  // Segundo ponto central: keyword de intenção comercial viável recupera a
  // avaliação o suficiente pra cruzar os 2 limiares ao mesmo tempo.
  assert.equal(decisionEtapa2.status, 'testar');
});
