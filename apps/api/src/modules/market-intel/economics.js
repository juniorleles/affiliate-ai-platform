/**
 * Motor de Economics (docs/ARQUITETURA.md, seção 5.1). Cálculo determinístico de
 * viabilidade financeira de um produto — sem IA, sem SQL, sem HTTP. Função pura,
 * 100% testável isoladamente (ver tests/unit/economics.test.js).
 */

const DEFAULT_MIN_COMMISSION = 20; // trava de segurança padrão — 20 unidades da MOEDA DO PRÓPRIO
                                    // PRODUTO (USD ou EUR, os únicos usados até hoje), não R$/BRL.
                                    // Corrigido em 2026-08-06: o comentário antigo dizia "R$" por engano
                                    // (herdado do MVP original) — os produtos reais cadastrados sempre
                                    // foram em EUR/USD, nunca em BRL. Sobrescrevível por parâmetro.
const DEFAULT_MARGIN_PCT = 30;     // margem desejada padrão sobre o CPC de equilíbrio

/**
 * Avalia a viabilidade financeira de um produto.
 *
 * @param {object} params
 * @param {number} params.comissaoEsperada - valor da comissão por venda, na moeda do produto
 * @param {number} params.taxaConversaoEsperada - taxa de conversão esperada (ex: 0.02 = 2%)
 * @param {number} [params.margemDesejadaPct=30] - margem de segurança sobre o CPC de equilíbrio
 * @param {number} [params.comissaoMinima=20] - trava de segurança: abaixo disso, rejeita direto
 *   (20 unidades da moeda do produto — USD ou EUR; ver DEFAULT_MIN_COMMISSION)
 * @param {number|null} [params.cpcLeilao=null] - CPC médio do leilão (vem da Fase 2b, opcional)
 * @param {string} [params.moeda='USD/EUR'] - só usada nas mensagens de motivo, pra não dizer "R$"
 *   quando o produto na verdade é EUR/USD — não faz conversão nenhuma, é rótulo apenas.
 * @returns {{status: string, comissaoMinimaOk: boolean, cpcEquilibrio: number|null,
 *            cpcMaximoCalculado: number|null, roiEstimadoPct: number|null, motivo: string|null}}
 */
function evaluateEconomics({
  comissaoEsperada,
  taxaConversaoEsperada,
  margemDesejadaPct = DEFAULT_MARGIN_PCT,
  comissaoMinima = DEFAULT_MIN_COMMISSION,
  cpcLeilao = null,
  moeda = '',
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
      motivo: `Comissão de ${moeda} ${comissaoEsperada.toFixed(2)} está abaixo do mínimo configurado de ${moeda} ${comissaoMinima.toFixed(2)}.`,
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
    motivo = `CPC médio do leilão (${moeda} ${cpcLeilao.toFixed(2)}) é maior que o CPC máximo ` +
      `aceitável (${moeda} ${cpcMaximoCalculado.toFixed(2)}).`;
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
