/**
 * Conversão de câmbio ENTRE a moeda de um produto (ex: EUR, vindo da rede de
 * afiliados) e a moeda da conta do Google Ads (onde o leilão de CPC acontece).
 *
 * Escopo deliberadamente pequeno: taxa configurada manualmente no .env, não é
 * cotação ao vivo. Pro volume atual (poucos produtos, cadastro manual) isso é
 * proporcional — se o volume crescer e/ou aparecerem mais moedas além de EUR,
 * trocar por uma API de câmbio de verdade (ex: exchangerate.host) vira a
 * decisão certa, mas seria over-engineering fazer isso agora.
 */

const SUPPORTED_SOURCE_CURRENCIES = ['EUR'];

/**
 * Retorna quantas unidades de `toCurrency` equivalem a 1 unidade de `fromCurrency`.
 * Lança erro claro se a conversão não estiver configurada — nunca inventa taxa.
 */
function getFxRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return 1;

  if (fromCurrency === 'EUR') {
    const rate = Number(process.env.FX_EUR_TO_ACCOUNT_CURRENCY);
    if (!rate || isNaN(rate)) {
      throw new Error(
        `Taxa de câmbio EUR -> ${toCurrency} não configurada. Defina ` +
        `FX_EUR_TO_ACCOUNT_CURRENCY no .env (ex: 6.10 se a conta do Google Ads ` +
        `estiver em BRL). Confira a cotação atual antes de definir.`
      );
    }
    return rate;
  }

  throw new Error(
    `Conversão de câmbio não suportada ainda para moeda de origem "${fromCurrency}". ` +
    `Moedas suportadas: ${SUPPORTED_SOURCE_CURRENCIES.join(', ')}. Ver shared/fx.js.`
  );
}

/**
 * Converte um valor de `fromCurrency` para `toCurrency`.
 */
function convert(value, fromCurrency, toCurrency) {
  if (value == null) return null;
  const rate = getFxRate(fromCurrency, toCurrency);
  return Math.round((value * rate) * 10000) / 10000;
}

module.exports = { getFxRate, convert };
