const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateCommission } = require('../../src/modules/affiliate-ops/commission');

test('comissão percentual calcula corretamente', () => {
  const affiliate = { commission_type: 'percentage', commission_value: 10 };
  assert.equal(calculateCommission(affiliate, 200), 20);
});

test('comissão fixa ignora o valor da venda', () => {
  const affiliate = { commission_type: 'flat', commission_value: 15 };
  assert.equal(calculateCommission(affiliate, 500), 15);
});

test('sem regra própria, usa o padrão global das env vars', () => {
  process.env.DEFAULT_COMMISSION_TYPE = 'percentage';
  process.env.DEFAULT_COMMISSION_VALUE = '5';
  const affiliate = { commission_type: null, commission_value: null };
  assert.equal(calculateCommission(affiliate, 100), 5);
});

test('arredonda para 2 casas decimais', () => {
  const affiliate = { commission_type: 'percentage', commission_value: 33.33 };
  assert.equal(calculateCommission(affiliate, 100), 33.33);
});
