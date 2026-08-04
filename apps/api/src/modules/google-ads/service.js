const { fetchCampaignMetrics, fetchAccountCurrency } = require('./googleAdsClient');
const keywordResearch = require('./keywordResearch');
const repo = require('./repository');
const discoveryRepo = require('../discovery/repository');
const { evaluateEconomics } = require('../market-intel/economics');
const aiAdvisor = require('../ai-advisor/service');
const pool = require('../../shared/db/pool');
const fx = require('../../shared/fx');

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

  if (ideas.length) await repo.insertKeywordMetrics(productId, ideas);

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

async function getAccountCurrency() {
  return fetchAccountCurrency();
}

module.exports = {
  syncCampaigns,
  listCampaigns,
  updateCampaignTargets,
  analyzeCampaign,
  getCampaignHistory,
  researchKeywordsForProduct,
  getKeywordMetrics,
  getAccountCurrency,
  listAllCampaigns: repo.listAllCampaigns,
  getDailyMetrics: repo.getDailyMetrics,
  getAffiliateStatsForCampaign: repo.getAffiliateStatsForCampaign,
};
