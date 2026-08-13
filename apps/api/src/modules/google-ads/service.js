const { fetchCampaignMetrics, fetchAccountCurrency, fetchAccountStatus, fetchAccountHierarchy } = require('./googleAdsClient');
const keywordResearch = require('./keywordResearch');
const repo = require('./repository');
const discoveryRepo = require('../discovery/repository');
const { evaluateEconomics } = require('../market-intel/economics');
const aiAdvisor = require('../ai-advisor/service');
const pool = require('../../shared/db/pool');
const fx = require('../../shared/fx');
const { classifyKeywordIntent } = require('./keywordIntent');

async function syncCampaigns() {
  const rows = await fetchCampaignMetrics();
  return repo.upsertCampaignsAndMetrics(rows);
}

async function listCampaigns() {
  const campaigns = await repo.listCampaignsWithMetrics();
  const affiliateStats = await repo.getAffiliateStatsByCampaignName();
  const affMap = new Map(affiliateStats.map(a => [a.campaign_name.toLowerCase(), a]));

  const latestAnalyses = await repo.getLatestAnalysesByCampaign();
  const analysisMap = new Map(latestAnalyses.map(a => [a.subject_id, a]));

  return campaigns.map(c => {
    const aff = affMap.get(c.name.toLowerCase()) || { conversions: 0, revenue: 0 };
    return {
      ...c,
      affiliate_conversions_30d: Number(aff.conversions),
      affiliate_revenue_30d: Number(aff.revenue),
      latest_analysis: analysisMap.get(c.id) || null,
    };
  });
}

async function updateCampaignTargets(id, { target_cpa, target_roas }) {
  const campaign = await repo.findCampaignById(id);
  if (!campaign) throw Object.assign(new Error('Campanha não encontrada.'), { status: 404 });
  return repo.updateCampaignTargets(id, { targetCpa: target_cpa, targetRoas: target_roas });
}

async function analyzeCampaign(id) {
  const campaign = await repo.findCampaignById(id);
  if (!campaign) throw Object.assign(new Error('Campanha não encontrada.'), { status: 404 });

  const dailyMetrics = await repo.getDailyMetrics(id);
  if (!dailyMetrics.length) {
    throw Object.assign(
      new Error('Sem dados sincronizados para esta campanha. Rode a sincronização primeiro.'),
      { status: 400 }
    );
  }

  const affiliateStats = await repo.getAffiliateStatsForCampaign(campaign.name);

  return aiAdvisor.analyzeCampaignBudget({ campaign, dailyMetrics, affiliateStats });
}

async function getCampaignHistory(id) {
  return aiAdvisor.getHistory('campaign', Number(id));
}

/**
 * Fase 2b: pesquisa palavra-chave/leilão pra um produto e re-avalia Economics
 * com o CPC de leilão real como fato (não mais só o teto calculado sem
 * confrontar com o mercado). Grava um novo snapshot em product_economics —
 * não sobrescreve o anterior, é histórico.
 */
async function researchKeywordsForProduct(productId, { seedKeyword, minCommission } = {}) {
  const product = await discoveryRepo.findProductById(productId);
  if (!product) throw Object.assign(new Error('Produto não encontrado.'), { status: 404 });

  const keyword = seedKeyword || product.name;
  const ideas = await keywordResearch.fetchKeywordIdeas({ seedKeyword: keyword });

  if (ideas.length) await repo.insertKeywordMetrics(productId, ideas, 'generic');

  const primary = ideas.find(k => k.keywordText.toLowerCase() === keyword.toLowerCase()) || ideas[0];
  let cpcLeilaoRaw = null;
  if (primary && primary.topOfPageBidLow != null && primary.topOfPageBidHigh != null) {
    cpcLeilaoRaw = (primary.topOfPageBidLow + primary.topOfPageBidHigh) / 2;
  }

  // Conversão de moeda: o leilão vem na moeda da CONTA do Google Ads; a
  // comissão do produto está na moeda que a rede de afiliados usa (registrada
  // em products.currency). Comparar sem converter é o bug de 2026-08-04 —
  // não repetir. Ver docs/ARQUITETURA.md.
  const productCurrency = product.currency || 'EUR';
  const accountCurrency = await fetchAccountCurrency();
  let cpcLeilao = cpcLeilaoRaw;
  let currencyConversion = null;

  if (cpcLeilaoRaw != null && accountCurrency && accountCurrency !== productCurrency) {
    const rate = fx.getFxRate(productCurrency, accountCurrency);
    cpcLeilao = Math.round((cpcLeilaoRaw / rate) * 10000) / 10000;
    currencyConversion = {
      leilao_moeda_original: accountCurrency,
      leilao_valor_original: cpcLeilaoRaw,
      produto_moeda: productCurrency,
      taxa_usada: rate,
      leilao_convertido: cpcLeilao,
    };
  }

  let economics = null;
  if (cpcLeilao != null) {
    const result = evaluateEconomics({
      comissaoEsperada: Number(product.commission_value),
      taxaConversaoEsperada: Number(product.conversion_rate) || 0,
      comissaoMinima: minCommission,
      cpcLeilao,
      moeda: productCurrency || '',
    });

    await pool.query(
      `INSERT INTO product_economics
         (product_id, comissao_usada, taxa_conversao_esperada, cpc_maximo_calculado,
          comissao_minima_ok, status)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [productId, product.commission_value, product.conversion_rate,
        result.cpcMaximoCalculado, result.comissaoMinimaOk, result.status]
    );
    economics = result;
  }

  return { keyword, totalIdeas: ideas.length, ideas, accountCurrency, productCurrency, currencyConversion, cpcLeilao, economics };
}

async function getKeywordMetrics(productId) {
  return repo.getLatestKeywordMetrics(productId);
}

// Modificadores de intenção comercial (2026-08-05) — a pesquisa padrão de
// keyword (seed genérico, ex: nome do produto) traz principalmente termo
// informacional/comparativo, porque é assim que o Keyword Planner expande
// "ideias relacionadas" de um seed genérico. Pra enriquecer o pool com termo
// de fundo de funil de verdade, roda o MESMO Keyword Planner com seeds já
// orientados a compra — não é uma API nova, é usar a existente com
// intenção melhor no input.
const COMMERCIAL_INTENT_MODIFIERS = [
  base => `buy ${base}`,
  base => `${base} price`,
  base => `${base} discount`,
  base => `${base} coupon`,
  base => `where to buy ${base}`,
];

/**
 * Roda o Keyword Planner várias vezes, uma por seed de intenção comercial,
 * pra alimentar keyword_metrics com termo de fundo de funil. Não recalcula
 * Economics (isso já acontece em researchKeywordsForProduct) — o objetivo
 * aqui é só enriquecer o pool de candidatos que selectDraftKeywords() usa
 * na Fase 6. Continua mesmo se 1 seed falhar, pra não perder o resto.
 */
async function researchCommercialIntentKeywords(productId, { baseSeed, modifiers } = {}) {
  const product = await discoveryRepo.findProductById(productId);
  if (!product) throw Object.assign(new Error('Produto não encontrado.'), { status: 404 });

  const base = baseSeed || product.name;
  const templates = (modifiers && modifiers.length)
    ? modifiers.map(m => b => `${m} ${b}`.trim())
    : COMMERCIAL_INTENT_MODIFIERS;
  const seeds = templates.map(fn => fn(base));

  const resultsPerSeed = [];
  for (const seed of seeds) {
    try {
      const ideas = await keywordResearch.fetchKeywordIdeas({ seedKeyword: seed });
      if (ideas.length) await repo.insertKeywordMetrics(productId, ideas, 'commercial_intent');
      resultsPerSeed.push({ seed, found: ideas.length });
    } catch (err) {
      console.warn(`[keyword-research] Falha na busca de intenção comercial pro seed "${seed}":`, err.message);
      resultsPerSeed.push({ seed, found: 0, error: err.message });
    }
  }

  const allMetrics = await repo.getLatestKeywordMetrics(productId);
  const bottomFunnelCount = allMetrics.filter(k => classifyKeywordIntent(k.keyword_text).stage === 'bottom').length;

  return {
    seedsUsed: seeds,
    resultsPerSeed,
    totalKeywordsAgora: allMetrics.length,
    comSinalDeFundoDeFunilAgora: bottomFunnelCount,
  };
}

async function getAccountCurrency() {
  return fetchAccountCurrency();
}

// --- Contas do Google Ads (Fase 7, suporte multi-conta) ---

async function addAccount({
  customerId, name, loginCustomerId, isDefault,
  mccId, operacao, marca, regiao, dominio, paymentMethodLabel, dailyBudgetCap,
}) {
  if (!customerId) throw Object.assign(new Error('customerId é obrigatório.'), { status: 400 });
  return repo.createAccount({
    customerId, name, loginCustomerId, isDefault,
    mccId, operacao, marca, regiao, dominio, paymentMethodLabel, dailyBudgetCap,
  });
}

// --- Governança "guarda-chuva" (2026-08-05) ---

async function addMcc({ mccCustomerId, name, parentMccId, notes }) {
  if (!mccCustomerId || !name) {
    throw Object.assign(new Error('mccCustomerId e name são obrigatórios.'), { status: 400 });
  }
  return repo.createMcc({ mccCustomerId, name, parentMccId, notes });
}

async function removeAccount(id) {
  const deleted = await repo.deleteAccount(id);
  if (!deleted) throw Object.assign(new Error('Conta não encontrada.'), { status: 404 });
  return deleted;
}

async function removeMcc(id) {
  try {
    const deleted = await repo.deleteMcc(id);
    if (!deleted) throw Object.assign(new Error('MCC não encontrada.'), { status: 404 });
    return deleted;
  } catch (err) {
    if (err.code === '23503') { // violação de foreign key do Postgres
      throw Object.assign(
        new Error('Ainda existe conta vinculada a essa MCC — reparenta ou exclui a(s) conta(s) primeiro.'),
        { status: 409 }
      );
    }
    throw err;
  }
}

/**
 * Descobre as contas reais sob uma MCC via API do Google (2026-08-06) e faz
 * upsert em google_ads_accounts — não sobrescreve campos de governança que
 * você já preencheu manualmente (operacao/marca/payment_method_label/etc.),
 * só cria contas novas encontradas e atualiza nome/status das que já existem.
 * A API do Google não sabe "qual operação"/"qual marca" — isso continua
 * sendo julgamento humano, preenchido depois na tela.
 */
async function syncAccountsFromMcc(mccId) {
  const mccs = await repo.listMccs();
  const mcc = mccs.find(m => m.id === Number(mccId));
  if (!mcc) throw Object.assign(new Error('MCC não encontrada.'), { status: 404 });

  const discovered = await fetchAccountHierarchy(mcc);
  const existingAccounts = await repo.listAccounts();
  const existingByCustomerId = new Map(existingAccounts.map(a => [a.customer_id, a]));

  let created = 0, updated = 0, reparented = 0, skippedManagers = 0;
  for (const acc of discovered) {
    if (acc.isManager) { skippedManagers++; continue; } // sub-MCC, não é conta de gasto — não cadastra como "conta"

    const existing = existingByCustomerId.get(acc.customerId);
    if (existing) {
      if (existing.mcc_id !== mcc.id) reparented++;
      await repo.updateAccountFromSync(existing.id, { status: acc.status || 'unknown', mccId: mcc.id });
      updated++;
    } else {
      await repo.createAccount({
        customerId: acc.customerId,
        name: acc.name,
        mccId: mcc.id,
      });
      created++;
    }
  }

  return { mccName: mcc.name, totalDiscovered: discovered.length, created, updated, reparented, skippedManagers };
}

async function getGovernanceRollup() {
  return repo.getGovernanceRollup();
}

/**
 * Consulta o status real de todas as contas cadastradas via API do Google Ads
 * e atualiza no banco. Base da detecção de suspensão (Fase 7, Parte A).
 */
async function refreshAllAccountStatuses() {
  const accounts = await repo.listAccounts();
  const results = [];
  for (const account of accounts) {
    try {
      const status = await fetchAccountStatus(account);
      await repo.updateAccountStatus(account.id, status || 'unknown');
      results.push({ accountId: account.id, name: account.name, status });
    } catch (err) {
      results.push({ accountId: account.id, name: account.name, error: err.message });
    }
  }
  return results;
}

module.exports = {
  syncCampaigns,
  listCampaigns,
  updateCampaignTargets,
  analyzeCampaign,
  getCampaignHistory,
  researchKeywordsForProduct,
  researchCommercialIntentKeywords,
  getKeywordMetrics,
  getAccountCurrency,
  listAllCampaigns: repo.listAllCampaigns,
  getDailyMetrics: repo.getDailyMetrics,
  getAffiliateStatsForCampaign: repo.getAffiliateStatsForCampaign,
  listAccounts: repo.listAccounts,
  addAccount,
  removeAccount,
  refreshAllAccountStatuses,
  listMccs: repo.listMccs,
  addMcc,
  removeMcc,
  getGovernanceRollup,
  syncAccountsFromMcc,
};
