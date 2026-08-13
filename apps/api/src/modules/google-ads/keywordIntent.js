/**
 * Classificação de estágio de funil de uma palavra-chave — função pura, sem IA,
 * sem SQL (mesmo padrão de scoring.js). Existe porque a estratégia do projeto é
 * fundo de funil (alta intenção de compra), mas o Keyword Planner devolve
 * termos de todos os estágios misturados (achado real, 2026-08-05 — "glutamin"
 * e "bcaa supplements", termos informacionais/genéricos de alto volume, vinham
 * priorizados sobre termos de intenção de compra só por terem mais busca).
 *
 * Lista de sinais é heurística (PT-BR + EN, já que testamos produto em inglês
 * pra público americano) — não é perfeita, mas é barata, transparente e
 * testável, ao contrário de pedir pra IA "adivinhar" intenção sem critério
 * explícito.
 */

const BOTTOM_FUNNEL_SIGNALS = [
  'buy', 'order', 'purchase', 'discount', 'coupon', 'deal', 'price', 'cost',
  'cheap', 'official', 'review', 'reviews', 'shop', 'sale', 'delivery', 'for sale',
  'comprar', 'preco', 'desconto', 'cupom', 'oferta', 'onde comprar',
  'avaliacao', 'avaliacoes', 'analise', 'barato', 'frete', 'loja',
  'site oficial', 'comprar online',
];

function findBottomFunnelSignals(keywordText) {
  const lower = (keywordText || '').toLowerCase();
  return BOTTOM_FUNNEL_SIGNALS.filter(signal => lower.includes(signal));
}

function classifyKeywordIntent(keywordText) {
  const signals = findBottomFunnelSignals(keywordText);
  return { stage: signals.length > 0 ? 'bottom' : 'unclear', matchedSignals: signals };
}

/**
 * Seleciona até `limit` keywords pra um rascunho de campanha, a partir da
 * lista bruta de keyword_metrics: remove excluídas (substring, case-insensitive
 * — bug real corrigido em 2026-08-05, era comparação exata antes), remove
 * duplicatas por texto (bug real corrigido no mesmo dia), prioriza fundo de
 * funil, usa o resto só pra completar. Função pura — sem SQL, testável isolada.
 */
function selectDraftKeywords(keywordMetrics, { excludeTerms = [], limit = 10 } = {}) {
  const normalizedExcludes = excludeTerms.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
  const isExcluded = (text) => {
    const lower = (text || '').toLowerCase();
    return normalizedExcludes.some(term => lower.includes(term));
  };

  const seen = new Set();
  const available = (keywordMetrics || [])
    .filter(k => !isExcluded(k.keyword_text))
    .filter(k => {
      const key = k.keyword_text.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(k => ({ ...k, intent: classifyKeywordIntent(k.keyword_text) }));

  // Bug real corrigido em 2026-08-05 (achado testando a pesquisa de intenção
  // comercial): exigir top_of_page_bid_low != null era rigor demais pra montar
  // LISTA DE KEYWORDS do anúncio — bom pra estimar CPC de leilão (Fase 2b), mas
  // descartava termo de cauda longa/comercial real só porque o Google não tinha
  // dado de leilão suficiente pra estimar preço (comum em seed muito específico,
  // ex: "buy Advanced Amino Formula" — retornou a própria frase como ideia, sem
  // bid). Agora não filtra por bid, só usa como critério de ORDEM secundário
  // (dentro do mesmo estágio de funil, prefere quem tem dado de leilão).
  const hasBid = k => k.top_of_page_bid_low != null;
  const byBidThenVolume = (a, b) => {
    if (hasBid(a) !== hasBid(b)) return hasBid(a) ? -1 : 1;
    return (Number(b.avg_monthly_searches) || 0) - (Number(a.avg_monthly_searches) || 0);
  };
  const bottomFunnel = available.filter(k => k.intent.stage === 'bottom').sort(byBidThenVolume);
  const unclear = available.filter(k => k.intent.stage === 'unclear').sort(byBidThenVolume);

  return [...bottomFunnel, ...unclear].slice(0, limit).map(k => ({
    text: k.keyword_text,
    matchType: 'phrase',
    funnelStage: k.intent.stage,
    hasBidData: hasBid(k),
  }));
}

module.exports = { classifyKeywordIntent, findBottomFunnelSignals, selectDraftKeywords, BOTTOM_FUNNEL_SIGNALS };
