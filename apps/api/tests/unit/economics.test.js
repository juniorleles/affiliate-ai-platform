const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateEconomics, estimateRoi } = require('../../src/modules/market-intel/economics');

test('calcula CPC de equilíbrio e CPC máximo corretamente, aplicando a margem', () => {
  const result = evaluateEconomics({
    comissaoEsperada: 100,
    taxaConversaoEsperada: 0.02, // 2%
    margemDesejadaPct: 30,
  });
  // CPC de equilíbrio = 100 * 0.02 = 2.00
  // CPC máximo = 2.00 * (1 - 0.30) = 1.40
  assert.equal(result.status, 'viavel');
  assert.equal(result.cpcEquilibrio, 2);
  assert.equal(result.cpcMaximoCalculado, 1.4);
});

test('trava de comissão mínima rejeita produto abaixo do limiar', () => {
  const result = evaluateEconomics({
    comissaoEsperada: 15,
    taxaConversaoEsperada: 0.02,
    comissaoMinima: 20,
  });
  assert.equal(result.status, 'rejeitado_por_comissao_minima');
  assert.equal(result.comissaoMinimaOk, false);
  assert.equal(result.cpcMaximoCalculado, null);
});

test('trava de comissão mínima NÃO dispara quando comissão está no limiar ou acima', () => {
  const noLimiar = evaluateEconomics({ comissaoEsperada: 20, taxaConversaoEsperada: 0.02, comissaoMinima: 20 });
  const acima = evaluateEconomics({ comissaoEsperada: 25, taxaConversaoEsperada: 0.02, comissaoMinima: 20 });
  assert.equal(noLimiar.status, 'viavel');
  assert.equal(acima.status, 'viavel');
});

test('taxa de conversão 0 não lança erro nem aprova/rejeita — marca dado insuficiente', () => {
  const result = evaluateEconomics({ comissaoEsperada: 100, taxaConversaoEsperada: 0 });
  assert.equal(result.status, 'dado_insuficiente');
  assert.equal(result.cpcMaximoCalculado, 0);
});

test('rejeita por leilão caro quando CPC do leilão excede o CPC máximo calculado', () => {
  const result = evaluateEconomics({
    comissaoEsperada: 100,
    taxaConversaoEsperada: 0.02, // CPC máximo = 1.40 (margem padrão 30%)
    cpcLeilao: 2.5,
  });
  assert.equal(result.status, 'rejeitado_por_economics');
  assert.match(result.motivo, /maior que o CPC máximo/);
});

test('aprova quando CPC do leilão está dentro do CPC máximo calculado', () => {
  const result = evaluateEconomics({
    comissaoEsperada: 100,
    taxaConversaoEsperada: 0.02, // CPC máximo = 1.40
    cpcLeilao: 1.0,
  });
  assert.equal(result.status, 'viavel');
  assert.equal(result.motivo, null);
});

test('lança erro claro quando comissaoEsperada está ausente ou não numérica', () => {
  assert.throws(() => evaluateEconomics({ taxaConversaoEsperada: 0.02 }), /comissaoEsperada/);
  assert.throws(() => evaluateEconomics({ comissaoEsperada: 'abc', taxaConversaoEsperada: 0.02 }), /comissaoEsperada/);
});

test('lança erro claro quando taxaConversaoEsperada está ausente, negativa ou não numérica', () => {
  assert.throws(() => evaluateEconomics({ comissaoEsperada: 100 }), /taxaConversaoEsperada/);
  assert.throws(() => evaluateEconomics({ comissaoEsperada: 100, taxaConversaoEsperada: -0.1 }), /taxaConversaoEsperada/);
});

test('estimateRoi calcula corretamente com custo estimado válido', () => {
  const roi = estimateRoi({ comissaoEsperada: 100, conversoesEsperadas: 10, custoEstimado: 500 });
  // receita = 100 * 10 = 1000; ROI = (1000 - 500) / 500 = 100%
  assert.equal(roi, 100);
});

test('estimateRoi retorna null sem custo estimado (não inventa número)', () => {
  assert.equal(estimateRoi({ comissaoEsperada: 100, conversoesEsperadas: 10, custoEstimado: 0 }), null);
  assert.equal(estimateRoi({ comissaoEsperada: 100, conversoesEsperadas: 10, custoEstimado: null }), null);
});
