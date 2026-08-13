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
const decisionEngineRepo = require('../decision-engine/repository');
const { fetchPageText } = require('../discovery/lpTextFetch');
const aiAdvisor = require('../ai-advisor/service');
const repo = require('./repository');
const { selectDraftKeywords } = require('./keywordIntent');

const MAX_DAILY_BUDGET = Number(process.env.MAX_DAILY_BUDGET_HARD_CAP || 100);

async function createDraft({ productId, googleAdsAccountId, name, dailyBudget, excludeKeywordTerms, overrideDecision }) {
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

  // Trava do Decision Engine (2026-08-06, pedido do usuário) — antes de hoje,
  // dava pra gerar rascunho de qualquer produto, mesmo um que a Fase 12 já
  // tinha classificado "descartar". `descartar` bloqueia por padrão (você
  // pode passar `overrideDecision: true` se tiver um motivo real pra ir
  // contra o sistema — não é trava dura tipo orçamento, é decisão reversível
  // com esforço extra de propósito). `investigar` não bloqueia, só avisa —
  // ficaria estranho impedir totalmente algo que o próprio sistema já
  // classificou como "ainda não sei". Produto nunca avaliado (sem decisão
  // salva) não bloqueia — falha aberto, não trava fluxo que nunca usou essa
  // fase ainda.
  const decision = await decisionEngineRepo.getLatestDecision(productId);
  let decisionWarning = null;
  if (decision) {
    if (decision.decision_status === 'descartar' && !overrideDecision) {
      throw Object.assign(
        new Error(
          `O Decision Engine classificou esse produto como "descartar" ` +
          `(motivo: ${decision.stopped_reason}, opportunity=${decision.score}, ` +
          `confidence=${decision.confidence_score}). Se você tem um motivo real pra seguir mesmo assim, ` +
          `chame de novo com { overrideDecision: true }.`
        ),
        { status: 409 }
      );
    }
    // Achado real (2026-08-06): quando overrideDecision ignora um "descartar",
    // a resposta não deixava rastro nenhum disso — alguém revisando o
    // rascunho depois não teria como saber que ele foi criado CONTRA um
    // veredito explícito do sistema. Corrigido: o override some no
    // silêncio, o AVISO não.
    if (decision.decision_status === 'descartar' && overrideDecision) {
      decisionWarning = `⚠️ Rascunho criado com overrideDecision=true, ignorando um veredito de "descartar" do Decision Engine (motivo: ${decision.stopped_reason}, opportunity=${decision.score}, confidence=${decision.confidence_score}). Revisão humana explícita foi usada pra seguir mesmo assim.`;
    }
    if (decision.decision_status === 'investigar') {
      decisionWarning = `Atenção: o Decision Engine ainda está em "investigar" pra esse produto (motivo: ${decision.stopped_reason}) — a decisão de anunciar ainda não tem confiança suficiente. Rascunho gerado mesmo assim, revise com cuidado extra.`;
    }
  }

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
  // Planner faz isso de propósito, mas não deveria virar sugestão automática
  // de compra sem aviso. `excludeKeywordTerms` deixa você filtrar as que já
  // conhece; o texto de cópia sempre avisa pra revisar as demais.
  //
  // 2 bugs reais corrigidos em 2026-08-05 (achados testando com dado real):
  // exclusão comparava a keyword INTEIRA em vez de substring (excluir "xtend"
  // não pegava "xtend bcaa"), e keyword_metrics podia ter a mesma keyword_text
  // duplicada de pesquisas com seeds diferentes que se sobrepõem — sem dedupe,
  // ocupava 2 das 10 vagas por engano. Lógica de seleção extraída pra
  // keywordIntent.js#selectDraftKeywords() — função pura, testável, ambos os
  // bugs cobertos por teste unitário agora.
  const topKeywords = selectDraftKeywords(keywordMetrics, { excludeTerms: excludeKeywordTerms, limit: 10 });

  if (!topKeywords.some(k => k.funnelStage === 'bottom')) {
    console.warn('[campaign-drafts] Nenhuma keyword com sinal de fundo de funil encontrada — rascunho usando só termos "unclear". Considere pesquisar keywords mais específicas (Fase 2b) ou revisar manualmente antes de aprovar.');
  }

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

  return { draft: rows[0], correspondenceCheck: copy.correspondence_check, decisionWarning };
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
    ...keywords.map(k => {
      const flags = [];
      if (k.funnelStage !== 'bottom') flags.push('sem sinal claro de fundo de funil');
      if (k.hasBidData === false) flags.push('sem dado de leilão — defina lance manual');
      const flagText = flags.length ? `  [revisar: ${flags.join('; ')}]` : '';
      return `  ${(matchSymbol[k.matchType] || matchSymbol.phrase)(k.text)}${flagText}`;
    }),
    '  ⚠️  Revise antes de colar: (1) marca de CONCORRENTE pode aparecer numa pesquisa',
    '      geral (ex: "xtend"/"kion" apareceram numa pesquisa real de suplemento) — use',
    '      excludeKeywordTerms pra remover as que você já conhece; (2) termos marcados',
    '      "sem sinal claro de fundo de funil" acima são o que sobrou pra completar 10 —',
    '      confirme se ainda fazem sentido pra campanha de alta intenção de compra.',
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
