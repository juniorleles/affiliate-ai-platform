const { test } = require('node:test');
const assert = require('node:assert/strict');
const scoring = require('../../src/modules/market-intel/scoring');

test('computeDemandScore: null sem dado, 0 pra busca zerada, escala log crescente', () => {
  assert.equal(scoring.computeDemandScore(null), null);
  assert.equal(scoring.computeDemandScore(0), 0);
  assert.ok(scoring.computeDemandScore(100) < scoring.computeDemandScore(10000));
  assert.ok(scoring.computeDemandScore(10000) < scoring.computeDemandScore(450000));
});

test('computeCompetitionScore: prioriza índice numérico sobre o nível textual', () => {
  assert.equal(scoring.computeCompetitionScore('high', 30), 70); // usa o índice (100-30), ignora "high"
  assert.equal(scoring.computeCompetitionScore('low', null), 80);
  assert.equal(scoring.computeCompetitionScore('high', null), 20);
  assert.equal(scoring.computeCompetitionScore(null, null), null);
});

test('computeEconomicsScore: mapeia cada status de economics corretamente', () => {
  assert.equal(scoring.computeEconomicsScore('viavel'), 75);
  assert.equal(scoring.computeEconomicsScore('rejeitado_por_economics'), 25);
  assert.equal(scoring.computeEconomicsScore('rejeitado_por_comissao_minima'), 0);
  assert.equal(scoring.computeEconomicsScore('dado_insuficiente'), null);
  assert.equal(scoring.computeEconomicsScore(null), null);
});

test('computeLpQualityScore: parâmetro de afiliado quebrado penaliza fortemente', () => {
  const comParametroOk = scoring.computeLpQualityScore({ hasCta: true, hasVsl: false, affiliateParamsPreserved: true });
  const semAuditoria = scoring.computeLpQualityScore({});
  const parametroQuebrado = scoring.computeLpQualityScore({ hasCta: true, hasVsl: true, affiliateParamsPreserved: false });

  assert.equal(semAuditoria, null);
  assert.ok(parametroQuebrado < comParametroOk);
  assert.ok(parametroQuebrado < 40); // penalidade deve derrubar abaixo da base
});

test('computeOverallScore: ignora sub-scores null, não inventa valor pra lacuna', () => {
  const comTudo = scoring.computeOverallScore({ demand: 60, competition: 60, economics: 60, lpQuality: 60 });
  const soComEconomics = scoring.computeOverallScore({ demand: null, competition: null, economics: 60, lpQuality: null });
  assert.equal(comTudo, 60);
  assert.equal(soComEconomics, 60); // média ponderada só do que existe ainda dá 60
});

test('computeOverallScore: retorna null se não houver nenhum sub-score', () => {
  assert.equal(scoring.computeOverallScore({}), null);
  assert.equal(scoring.computeOverallScore({ demand: null, competition: null, economics: null, lpQuality: null }), null);
});
