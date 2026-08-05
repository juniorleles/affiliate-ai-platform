/**
 * PageSpeed Insights API — oficial do Google, gratuita, confirmada ativa
 * (diferente da Custom Search, essa não foi descontinuada). Dado REAL de
 * performance (Core Web Vitals), não estimado pela IA — ver docs/ARQUITETURA.md
 * seção 5.4, Fase 3d Camada A.
 *
 * GOOGLE_PAGESPEED_API_KEY é opcional — a API funciona sem chave em volume
 * baixo (cota compartilhada), e com chave própria (gerada no Google Cloud
 * Console, mesma tela onde pegamos o OAuth Client do Google Ads) tem cota
 * maior. Não é a mesma chave do Google Ads.
 */

const BASE_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

async function fetchPageSpeed(url, strategy = 'mobile') {
  const params = new URLSearchParams({ url, strategy, category: 'performance' });
  if (process.env.GOOGLE_PAGESPEED_API_KEY) {
    params.set('key', process.env.GOOGLE_PAGESPEED_API_KEY);
  }

  const response = await fetch(`${BASE_URL}?${params.toString()}`);
  const data = await response.json();

  if (data.error) {
    throw new Error(`PageSpeed Insights retornou erro: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const lighthouse = data.lighthouseResult;
  if (!lighthouse) {
    console.warn('[pagespeed] Resposta sem lighthouseResult. Chaves disponíveis:', Object.keys(data || {}));
    return null;
  }

  const perfScore = lighthouse.categories?.performance?.score;
  const audits = lighthouse.audits || {};

  return {
    performanceScore: perfScore != null ? Math.round(perfScore * 100) : null,
    largestContentfulPaintMs: audits['largest-contentful-paint']?.numericValue ?? null,
    cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue ?? null,
    firstContentfulPaintMs: audits['first-contentful-paint']?.numericValue ?? null,
    strategy,
  };
}

module.exports = { fetchPageSpeed };
