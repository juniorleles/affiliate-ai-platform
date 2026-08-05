// MÓDULO: competitive-intel (Módulo 3 do documento original)
//
// Fonte de dado decidida em 2026-08-05 (docs/ARQUITETURA.md seção 10, item 1):
// cadastro MANUAL, a partir do Google Ads Transparency Center
// (adstransparency.google.com) — ferramenta oficial e gratuita do Google, sem API
// pública. Mesmo padrão que já usamos pra produtos (Fase 2): sem API oficial,
// cadastro manual é o caminho, não scraping.

const repo = require('./repository');

/**
 * Cadastra (ou atualiza) um anúncio de concorrente. Se já existir um anúncio do
 * mesmo concorrente com o mesmo headline + landing page, NÃO cria um registro
 * duplicado — atualiza last_seen_at e grava um snapshot novo, preservando o
 * histórico (checklist da Fase 4 pede exatamente isso: mudança real gera
 * snapshot novo, não sobrescreve o anterior).
 */
async function addManualCompetitorAd(input) {
  const {
    competitorName, competitorDomain, productId, platform,
    headline, body, creativeUrl, landingPageUrl,
  } = input;

  if (!competitorName || !headline) {
    throw new Error('competitorName e headline são obrigatórios.');
  }

  const competitor = await repo.findOrCreateCompetitor(competitorName, competitorDomain);

  let ad = await repo.findMatchingAd(competitor.id, headline, landingPageUrl);
  let isNewAd = false;

  if (!ad) {
    ad = await repo.insertCompetitorAd({
      competitorId: competitor.id,
      productId: productId || null,
      platform: platform || 'google_ads',
      headline, body, creativeUrl, landingPageUrl,
    });
    isNewAd = true;
  } else {
    ad = await repo.touchAdLastSeen(ad.id);
  }

  const snapshot = await repo.insertSnapshot(ad.id, {
    headline, body, creativeUrl, landingPageUrl,
    fonte: 'Google Ads Transparency Center (cadastro manual)',
    registrado_em: new Date().toISOString(),
  });

  return { competitor, ad, snapshot, isNewAd };
}

async function listCompetitorAds(productId) {
  return repo.listAdsForProduct(productId);
}

async function listAllCompetitorAds() {
  return repo.listAllAds();
}

async function getAdHistory(adId) {
  return repo.getSnapshotHistory(adId);
}

module.exports = { addManualCompetitorAd, listCompetitorAds, listAllCompetitorAds, getAdHistory };
