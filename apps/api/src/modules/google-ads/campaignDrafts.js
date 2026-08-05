// MÓDULO: campaign drafts (Fase 6) — rascunho de campanha pronto pra você
// criar manualmente no Google Ads.
//
// Decisão de 2026-08-05: o sistema NUNCA cria campanha via API — só prepara
// o rascunho (orçamento validado contra o teto, palavras-chave reais, copy
// sugerida pela IA já checada contra a LP). Você copia pra dentro do Google
// Ads com suas próprias mãos. Isso elimina de propósito a parte mais
// arriscada do projeto (escrita real, nunca testada) sem perder o valor real
// (a parte difícil — decidir orçamento/keywords/copy — continua automatizada).

const pool = require('../../shared/db/pool');
const discoveryRepo = require('../discovery/repository');
const marketIntelRepo = require('../market-intel/repository');
const { fetchPageText } = require('../discovery/lpTextFetch');
const aiAdvisor = require('../ai-advisor/service');
const repo = require('./repository');

const MAX_DAILY_BUDGET = Number(process.env.MAX_DAILY_BUDGET_HARD_CAP || 100);

async function createDraft({ productId, googleAdsAccountId, name, dailyBudget, excludeKeywordTerms }) {
  if (!productId || !name || dailyBudget == null) {
    throw Object.assign(new Error('productId, name e dailyBudget são obrigatórios.'), { status: 400 });
  }
  if (Number(dailyBudget) > MAX_DAILY_BUDGET) {
    throw Object.assign(
      new Error(`Orçamento diário (${dailyBudget}) excede o teto configurado de ${MAX_DAILY_BUDGET} (MAX_DAILY_BUDGET_HARD_CAP no .env). Trava dura, não é ajustável por chamada individual.`),
      { status: 400 }
    );
  }

  const product = await discoveryRepo.findProductById(productId);
  if (!product) throw Object.assign(new Error('Produto não encontrado.'), { status: 404 });

  const economics = await marketIntelRepo.getLatestEconomics(productId);
  const keywordMetrics = await repo.getLatestKeywordMetrics(productId);

  let pageText = null;
  if (product.sales_page_url) {
    try {
      pageText = await fetchPageText(product.sales_page_url);
    } catch (err) {
      console.warn('[campaign-drafts] Falha ao buscar texto da LP, seguindo sem isso:', err.message);
    }
  }

  // Achado real (2026-08-05): a pesquisa de keyword (Fase 2b) traz "ideias
  // relacionadas" que incluem nomes de marca de CONCORRENTES (ex: "xtend bcaa",
  // "kion aminos" apareceram pra um produto de aminoácido) — o Google Keyword
  // Planner faz isso de propósito (mostra o que gente busca "vs"), mas não
  // deveria virar sugestão automática de compra sem aviso. Sem uma lista de
  // marcas mantida, não dá pra detectar isso 100% sozinho — por isso aceita
  // `excludeKeywordTerms` (você já sabe quais marcas evitar) e sempre avisa no
  // texto de cópia pra revisar antes de usar (ver formatDraftForCopy).
  const excludeSet = new Set((excludeKeywordTerms || []).map(t => t.toLowerCase().trim()).filter(Boolean));
  const topKeywords = (keywordMetrics || [])
    .filter(k => k.top_of_page_bid_low != null)
    .filter(k => !excludeSet.has(k.keyword_text.toLowerCase().trim()))
    .sort((a, b) => (Number(b.avg_monthly_searches) || 0) - (Number(a.avg_monthly_searches) || 0))
    .slice(0, 10)
    .map(k => ({ text: k.keyword_text, matchType: 'phrase' }));

  const { result: copy } = await aiAdvisor.generateAdCopy({
    product, pageText, keywords: topKeywords.map(k => k.text), economics,
  });

  const { rows } = await pool.query(
    `INSERT INTO campaign_drafts
       (product_id, google_ads_account_id, name, daily_budget, currency, keywords,
        final_url, headlines, descriptions, ai_copy_reasoning, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft')
     RETURNING *`,
    [
      productId, googleAdsAccountId || null, name, dailyBudget, product.currency || 'EUR',
      JSON.stringify(topKeywords), product.sales_page_url || null,
      JSON.stringify(copy.headlines), JSON.stringify(copy.descriptions), copy.reasoning,
    ]
  );

  return { draft: rows[0], correspondenceCheck: copy.correspondence_check };
}

async function listDrafts() {
  const { rows } = await pool.query('SELECT * FROM campaign_drafts ORDER BY created_at DESC');
  return rows;
}

async function findDraftById(id) {
  const { rows } = await pool.query('SELECT * FROM campaign_drafts WHERE id = $1', [id]);
  return rows[0] || null;
}

async function approveDraft(id) {
  const { rows } = await pool.query(
    `UPDATE campaign_drafts SET status = 'approved', approved_at = now()
     WHERE id = $1 AND status = 'draft' RETURNING *`,
    [id]
  );
  if (!rows[0]) {
    throw Object.assign(new Error('Rascunho não encontrado, ou já não está mais em status "draft".'), { status: 400 });
  }
  return rows[0];
}

/**
 * Marca o rascunho como "usado" — checkbox manual pra você registrar que já
 * criou a campanha de verdade no Google Ads com esses dados. Puro
 * bookkeeping, não chama nenhuma API do Google.
 */
async function markAsUsed(id, { googleCampaignId } = {}) {
  const draft = await findDraftById(id);
  if (!draft) throw Object.assign(new Error('Rascunho não encontrado.'), { status: 404 });
  if (draft.status !== 'approved') {
    throw Object.assign(
      new Error(`Rascunho precisa estar "approved" antes de marcar como usado (status atual: ${draft.status}).`),
      { status: 400 }
    );
  }

  const { rows } = await pool.query(
    `UPDATE campaign_drafts
     SET status = 'created_in_google_ads', google_campaign_id = $2, created_in_google_ads_at = now()
     WHERE id = $1 RETURNING *`,
    [id, googleCampaignId || null]
  );
  return rows[0];
}

/**
 * Formata o rascunho como texto simples, pronto pra você ler e digitar no
 * Google Ads — nome, orçamento, keywords com match type por extenso,
 * headlines/descrições numeradas, URL de destino.
 */
function formatDraftForCopy(draft) {
  const keywords = Array.isArray(draft.keywords) ? draft.keywords : JSON.parse(draft.keywords || '[]');
  const headlines = Array.isArray(draft.headlines) ? draft.headlines : JSON.parse(draft.headlines || '[]');
  const descriptions = Array.isArray(draft.descriptions) ? draft.descriptions : JSON.parse(draft.descriptions || '[]');

  const matchSymbol = { exact: (t) => `[${t}]`, phrase: (t) => `"${t}"`, broad: (t) => t };

  const lines = [
    `CAMPANHA: ${draft.name}`,
    `ORÇAMENTO DIÁRIO: ${draft.currency} ${Number(draft.daily_budget).toFixed(2)}`,
    `URL DE DESTINO: ${draft.final_url || '(preencher manualmente)'}`,
    '',
    `PALAVRAS-CHAVE (${keywords.length}):`,
    ...keywords.map(k => `  ${(matchSymbol[k.matchType] || matchSymbol.phrase)(k.text)}`),
    '  ⚠️  Revise antes de colar: keywords de pesquisa geral podem incluir nome de',
    '      marca de CONCORRENTE (ex: apareceu "xtend"/"kion" numa pesquisa real de',
    '      suplemento). O sistema não filtra marca automaticamente com confiança —',
    '      use excludeKeywordTerms ao gerar o rascunho pra remover as que você já conhece.',
    '',
    `HEADLINES (${headlines.length}):`,
    ...headlines.map((h, i) => `  ${i + 1}. ${h} (${h.length} caracteres)`),
    '',
    `DESCRIÇÕES (${descriptions.length}):`,
    ...descriptions.map((d, i) => `  ${i + 1}. ${d} (${d.length} caracteres)`),
  ];

  return lines.join('\n');
}

module.exports = {
  createDraft, listDrafts, findDraftById, approveDraft, markAsUsed,
  formatDraftForCopy, MAX_DAILY_BUDGET,
};
