const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getFxRate, convert } = require('../../src/shared/fx');

test('mesma moeda retorna taxa 1, sem precisar de configuração', () => {
  assert.equal(getFxRate('EUR', 'EUR'), 1);
  assert.equal(getFxRate('BRL', 'BRL'), 1);
});

test('EUR -> outra moeda usa FX_EUR_TO_ACCOUNT_CURRENCY quando configurada', () => {
  process.env.FX_EUR_TO_ACCOUNT_CURRENCY = '6.10';
  assert.equal(getFxRate('EUR', 'BRL'), 6.10);
});

test('EUR -> outra moeda lança erro claro quando taxa não está configurada', () => {
  delete process.env.FX_EUR_TO_ACCOUNT_CURRENCY;
  assert.throws(() => getFxRate('EUR', 'BRL'), /não configurada/);
});

test('moeda de origem não suportada lança erro claro (nunca inventa taxa)', () => {
  assert.throws(() => getFxRate('USD', 'BRL'), /não suportada/);
});

test('convert() aplica a taxa corretamente', () => {
  process.env.FX_EUR_TO_ACCOUNT_CURRENCY = '6.10';
  assert.equal(convert(2.94, 'EUR', 'BRL'), 17.934);
});

test('convert() com valor null retorna null sem lançar erro', () => {
  assert.equal(convert(null, 'EUR', 'BRL'), null);
});
