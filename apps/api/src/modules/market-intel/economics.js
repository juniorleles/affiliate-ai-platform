/**
 * Motor de Economics (docs/ARQUITETURA.md, seção 5.1). Cálculo determinístico de
 * viabilidade financeira de um produto — sem IA, sem SQL, sem HTTP. Função pura,
 * 100% testável isoladamente (ver tests/unit/economics.test.js).
 */

const DEFAULT_MIN_COMMISSION = 20; // R$ — trava de segurança padrão, sobrescrevível por parâmetro
const DEFAULT_MARGIN_PCT = 30;     // margem desejada padrão sobre o CPC de equilíbrio

/**
 * Avalia a viabilidade financeira de um produto.
 *
 * @param {object} params
 * @param {number} params.comissaoEsperada - valor da comissão por venda (R$)
 * @param {number} params.taxaConversaoEsperada - taxa de conversão esperada (ex: 0.02 = 2%)
 * @param {number} [params.margemDesejadaPct=30] - margem de segurança sobre o CPC de equilíbrio
 * @param {number} [params.comissaoMinima=20] - trava de segurança: abaixo disso, rejeita direto
 * @param {number|null} [params.cpcLeilao=null] - CPC médio do leilão (vem da Fase 2b, opcional)
 * @returns {{status: string, comissaoMinimaOk: boolean, cpcEquilibrio: number|null,
 *            cpcMaximoCalculado: number|null, roiEstimadoPct: number|null, motivo: string|null}}
 */
function evaluateEconomics({
  comissaoEsperada,
  taxaConversaoEsperada,
  margemDesejadaPct = DEFAULT_MARGIN_PCT,
  comissaoMinima = DEFAULT_MIN_COMMISSION,
  cpcLeilao = null,
}) {
  if (comissaoEsperada == null || isNaN(comissaoEsperada)) {
    throw new Error('comissaoEsperada é obrigatório e deve ser numérico.');
  }
  if (taxaConversaoEsperada == null || isNaN(taxaConversaoEsperada) || taxaConversaoEsperada < 0) {
    throw new Error('taxaConversaoEsperada é obrigatório, numérico e >= 0.');
  }

  // Trava de comissão mínima — checa ANTES de qualquer outro cálculo. Produto de
  // comissão baixa não compensa o esforço de análise, independente do resto.
  if (comissaoEsperada < comissaoMinima) {
    return {
      status: 'rejeitado_por_comissao_minima',
      comissaoMinimaOk: false,
      cpcEquilibrio: null,
      cpcMaximoCalculado: null,
      roiEstimadoPct: null,
      motivo: `Comissão de R$ ${comissaoEsperada.toFixed(2)} está abaixo do mínimo configurado de R$ ${comissaoMinima.toFixed(2)}.`,
    };
  }

  // Caso de borda: taxa de conversão = 0 significa "sem dado ainda" ou "produto não
  // converte" — NÃO é o mesmo que "CPC máximo = R$ 0,00" (isso rejeitaria qualquer
  // leilão real automaticamente) nem deve lançar erro de divisão por zero. O
  // comportamento correto é sinalizar dado insuficiente, sem aprovar nem rejeitar.
  if (taxaConversaoEsperada === 0) {
    return {
      status: 'dado_insuficiente',
      comissaoMinimaOk: true,
      cpcEquilibrio: 0,
      cpcMaximoCalculado: 0,
      roiEstimadoPct: null,
      motivo: 'Taxa de conversão esperada é 0 — dado insuficiente para calcular CPC máximo.',
    };
  }

  const cpcEquilibrio = comissaoEsperada * taxaConversaoEsperada;
  const cpcMaximoCalculado = cpcEquilibrio * (1 - margemDesejadaPct / 100);

  let status = 'viavel';
  let motivo = null;

  if (cpcLeilao != null && !isNaN(cpcLeilao) && cpcLeilao > cpcMaximoCalculado) {
    status = 'rejeitado_por_economics';
    motivo = `CPC médio do leilão (R$ ${cpcLeilao.toFixed(2)}) é maior que o CPC máximo ` +
      `aceitável (R$ ${cpcMaximoCalculado.toFixed(2)}).`;
  }

  return {
    status,
    comissaoMinimaOk: true,
    cpcEquilibrio: round2(cpcEquilibrio),
    cpcMaximoCalculado: round2(cpcMaximoCalculado),
    roiEstimadoPct: null, // só computável com estimateRoi(), quando houver custo estimado
    motivo,
  };
}

/**
 * ROI estimado = (receita esperada - custo estimado) / custo estimado.
 * Separado de evaluateEconomics() porque exige um dado que só existe depois de
 * simular um orçamento (custoEstimado) — não faz parte da avaliação de entrada.
 */
function estimateRoi({ comissaoEsperada, conversoesEsperadas, custoEstimado }) {
  if (!custoEstimado || custoEstimado <= 0) return null;
  const receita = comissaoEsperada * conversoesEsperadas;
  return round2(((receita - custoEstimado) / custoEstimado) * 100);
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

module.exports = { evaluateEconomics, estimateRoi, DEFAULT_MIN_COMMISSION, DEFAULT_MARGIN_PCT };
