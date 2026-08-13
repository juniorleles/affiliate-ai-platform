const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyKeywordIntent, findBottomFunnelSignals } = require('../../src/modules/google-ads/keywordIntent');

test('classifica como bottom quando há sinal de intenção de compra em inglês', () => {
  assert.equal(classifyKeywordIntent('buy amino acid supplement').stage, 'bottom');
  assert.equal(classifyKeywordIntent('amino acid supplement review').stage, 'bottom');
  assert.equal(classifyKeywordIntent('best price amino acid').stage, 'bottom');
});

test('classifica como bottom quando há sinal de intenção de compra em português', () => {
  assert.equal(classifyKeywordIntent('comprar suplemento de aminoácido').stage, 'bottom');
  assert.equal(classifyKeywordIntent('suplemento aminoacido preco').stage, 'bottom');
});

test('classifica como unclear termos genéricos/informacionais sem sinal', () => {
  assert.equal(classifyKeywordIntent('glutamin').stage, 'unclear');
  assert.equal(classifyKeywordIntent('bcaa supplements').stage, 'unclear');
  assert.equal(classifyKeywordIntent('amino acid supplement').stage, 'unclear');
});

test('não confunde marca de concorrente com sinal de intenção', () => {
  assert.equal(classifyKeywordIntent('xtend bcaa').stage, 'unclear');
  assert.equal(classifyKeywordIntent('kion aminos').stage, 'unclear');
});

test('findBottomFunnelSignals retorna os termos específicos encontrados', () => {
  const signals = findBottomFunnelSignals('amino acid supplement review and price');
  assert.ok(signals.includes('review'));
  assert.ok(signals.includes('price'));
  assert.equal(signals.length, 2);
});

test('lida com texto vazio ou nulo sem lançar erro', () => {
  assert.equal(classifyKeywordIntent('').stage, 'unclear');
  assert.equal(classifyKeywordIntent(null).stage, 'unclear');
});

// --- selectDraftKeywords: os 2 bugs reais encontrados em 2026-08-05 ---

const { selectDraftKeywords } = require('../../src/modules/google-ads/keywordIntent');

test('exclusão de termo funciona por substring, não match exato (bug real)', () => {
  const metrics = [
    { keyword_text: 'xtend bcaa', avg_monthly_searches: 22200, top_of_page_bid_low: 0.37 },
    { keyword_text: 'buy amino acid supplement', avg_monthly_searches: 100, top_of_page_bid_low: 1.5 },
  ];
  // Bug: excluir "xtend" não pegava "xtend bcaa" porque comparava a string inteira
  const result = selectDraftKeywords(metrics, { excludeTerms: ['xtend'] });
  assert.ok(!result.some(k => k.text === 'xtend bcaa'), 'xtend bcaa deveria ter sido excluído');
  assert.ok(result.some(k => k.text === 'buy amino acid supplement'));
});

test('remove keyword duplicada por texto (bug real)', () => {
  const metrics = [
    { keyword_text: 'advanced amino formula reviews', avg_monthly_searches: 1300, top_of_page_bid_low: 0.43 },
    { keyword_text: 'advanced amino formula reviews', avg_monthly_searches: 1300, top_of_page_bid_low: 0.43 },
    { keyword_text: 'buy amino acid supplement', avg_monthly_searches: 100, top_of_page_bid_low: 1.5 },
  ];
  const result = selectDraftKeywords(metrics);
  const occurrences = result.filter(k => k.text === 'advanced amino formula reviews').length;
  assert.equal(occurrences, 1, 'keyword duplicada deveria aparecer só 1 vez');
  assert.equal(result.length, 2, 'não deveria ter vaga desperdiçada com duplicata');
});

test('prioriza fundo de funil sobre volume, completa com unclear se faltar', () => {
  const metrics = [
    { keyword_text: 'bcaa supplements', avg_monthly_searches: 33100, top_of_page_bid_low: 0.27 }, // unclear, alto volume
    { keyword_text: 'buy amino formula', avg_monthly_searches: 100, top_of_page_bid_low: 1.5 },     // bottom, baixo volume
  ];
  const result = selectDraftKeywords(metrics);
  assert.equal(result[0].text, 'buy amino formula', 'fundo de funil deveria vir primeiro mesmo com menos volume');
  assert.equal(result[0].funnelStage, 'bottom');
  assert.equal(result[1].funnelStage, 'unclear');
});

test('keyword sem dado de leilão ainda é elegível (bug real, 2026-08-05) — só perde prioridade dentro do mesmo estágio de funil', () => {
  const metrics = [
    { keyword_text: 'buy advanced amino formula', avg_monthly_searches: null, top_of_page_bid_low: null }, // bottom, sem leilão
    { keyword_text: 'advanced amino formula price', avg_monthly_searches: 50, top_of_page_bid_low: 2.1 },   // bottom, com leilão
  ];
  const result = selectDraftKeywords(metrics);
  assert.equal(result.length, 2, 'a keyword sem dado de leilão não deveria ser descartada');
  assert.equal(result[0].text, 'advanced amino formula price', 'com dado de leilão vem primeiro, dentro do mesmo estágio');
  assert.equal(result[0].hasBidData, true);
  assert.equal(result[1].text, 'buy advanced amino formula');
  assert.equal(result[1].hasBidData, false);
});
