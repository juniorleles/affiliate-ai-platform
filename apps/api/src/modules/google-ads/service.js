const { fetchCampaignMetrics } = require('./googleAdsClient');
const repo = require('./repository');
const aiAdvisor = require('../ai-advisor/service');

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

module.exports = {
  syncCampaigns,
  listCampaigns,
  updateCampaignTargets,
  analyzeCampaign,
  getCampaignHistory,
  listAllCampaigns: repo.listAllCampaigns,
  getDailyMetrics: repo.getDailyMetrics,
  getAffiliateStatsForCampaign: repo.getAffiliateStatsForCampaign,
};
