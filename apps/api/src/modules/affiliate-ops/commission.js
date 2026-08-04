/**
 * Calcula a comissão de uma venda para um afiliado. Função pura — não toca banco,
 * não toca rede. É o que faz esse cálculo ser trivial de testar (ver commission.test.js).
 */
function calculateCommission(affiliate, saleValue) {
  const type = affiliate.commission_type || process.env.DEFAULT_COMMISSION_TYPE || 'percentage';
  const value = affiliate.commission_value != null
    ? Number(affiliate.commission_value)
    : Number(process.env.DEFAULT_COMMISSION_VALUE || 10);

  if (type === 'flat') {
    return Math.round(value * 100) / 100;
  }
  return Math.round(((saleValue * value) / 100) * 100) / 100;
}

module.exports = { calculateCommission };
