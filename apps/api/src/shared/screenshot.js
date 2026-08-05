/**
 * Captura de screenshot via ScreenshotOne (docs/ARQUITETURA.md seção 10, item 7 —
 * decisão de 2026-08-05, pesquisada contra 8 outras opções). 100 capturas grátis/mês
 * sem cartão, não cobra por captura que falha.
 *
 * Usada pra Camada B do Auditor de LP (5.4) — a única parte do sistema que precisa
 * "ver" a página, não só ler o texto.
 */

const BASE_URL = 'https://api.screenshotone.com/take';

async function fetchScreenshotBase64(url, { viewportWidth = 1280, viewportHeight = 900 } = {}) {
  const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY;
  if (!accessKey) {
    throw new Error('SCREENSHOTONE_ACCESS_KEY não configurada no .env. Crie uma conta grátis em screenshotone.com (100 capturas/mês sem cartão).');
  }

  const params = new URLSearchParams({
    access_key: accessKey,
    url,
    viewport_width: String(viewportWidth),
    viewport_height: String(viewportHeight),
    device_scale_factor: '1',
    format: 'jpg',
    image_quality: '80',
    full_page: 'true',
    full_page_max_height: '6000',
    block_ads: 'true',
    block_cookie_banners: 'true',
    block_trackers: 'true',
    timeout: '30',
  });

  const response = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ScreenshotOne retornou erro (HTTP ${response.status}): ${text.slice(0, 300)}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

async function fetchDesktopAndMobile(url) {
  const [desktop, mobile] = await Promise.all([
    fetchScreenshotBase64(url, { viewportWidth: 1280, viewportHeight: 900 }),
    fetchScreenshotBase64(url, { viewportWidth: 390, viewportHeight: 844 }),
  ]);
  return { desktop, mobile };
}

module.exports = { fetchScreenshotBase64, fetchDesktopAndMobile };
