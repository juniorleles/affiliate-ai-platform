/**
 * Busca e extrai o texto de uma landing page, preservando marcadores simples
 * de estrutura (H1/H2/H3, botão, lista) — ajuda a IA a diferenciar headline
 * de corpo de texto sem precisar de um parser de HTML completo. Simplificação
 * consciente pra Camada A (texto); não substitui análise visual (Camada B).
 */
async function fetchPageText(url, { maxChars = 15000 } = {}) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AffiliateAIPlatform/1.0)' },
  });
  if (!response.ok) {
    throw new Error(`Falha ao buscar a página (HTTP ${response.status}): ${url}`);
  }
  const html = await response.text();
  return extractStructuredText(html).slice(0, maxChars);
}

function extractStructuredText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<h1[^>]*>/gi, '\n[H1] ')
    .replace(/<h2[^>]*>/gi, '\n[H2] ')
    .replace(/<h3[^>]*>/gi, '\n[H3] ')
    .replace(/<\/h[1-3]>/gi, '\n')
    .replace(/<button[^>]*>/gi, '\n[BOTÃO] ')
    .replace(/<\/button>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { fetchPageText };
