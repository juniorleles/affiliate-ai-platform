/**
 * Connector Digistore24 (docs/ARQUITETURA.md, Fase 2).
 *
 * Autenticação: header X-DS-API-KEY (chave simples, sem OAuth) — confirmado na
 * documentação oficial (dev.digistore24.com/hc/en-us/articles/32479630493585).
 * Base URL: https://www.digistore24.com/api/call/FUNCTION
 *
 * ⚠️ ATENÇÃO — mapeamento de campos não 100% confirmado:
 * A função `listMarketplaceEntries` existe e é documentada oficialmente, mas a
 * referência completa (Swagger) é renderizada em JS e não foi possível inspecionar
 * os nomes exatos dos campos da resposta durante a escrita deste connector. O
 * parsing abaixo é defensivo: tenta os nomes mais prováveis (seguindo o padrão de
 * outras funções da mesma API, ex: `transaction_list`, `purchase_list`) e loga um
 * aviso claro se não encontrar. NA PRIMEIRA CHAMADA REAL, confira o `console.warn`
 * (se aparecer) e ajuste `extractEntries()` / `normalizeEntry()` abaixo com os
 * nomes de campo reais — isso é esperado, não é bug.
 */

const BASE_URL = 'https://www.digistore24.com/api/call';

function getApiKey() {
  const key = process.env.DIGISTORE24_API_KEY;
  if (!key) throw new Error('DIGISTORE24_API_KEY não configurada no .env.');
  return key;
}

async function callFunction(functionName, params = {}) {
  const url = new URL(`${BASE_URL}/${functionName}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-DS-API-KEY': getApiKey(),
      Accept: 'application/json',
    },
  });

  const body = await response.json();

  if (body.result !== 'success') {
    throw new Error(`Digistore24 API (${functionName}) retornou erro: ${body.message || 'sem mensagem'} (code: ${body.code || '?'})`);
  }

  return body.data;
}

/**
 * Tenta achar a lista de entradas do marketplace dentro do objeto `data`,
 * testando os nomes mais prováveis antes de desistir.
 */
function extractEntries(data) {
  const candidateKeys = ['marketplace_entry_list', 'entries', 'marketplace_entries', 'list'];
  for (const key of candidateKeys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  // Fallback: pega o primeiro campo que for um array, seja ele qual for
  const firstArrayField = Object.entries(data || {}).find(([, v]) => Array.isArray(v));
  if (firstArrayField) {
    console.warn(
      `[digistore24] Nenhuma das chaves esperadas (${candidateKeys.join(', ')}) foi encontrada. ` +
      `Usando "${firstArrayField[0]}" como fallback — CONFIRME se é o campo certo e ajuste ` +
      `extractEntries() em connectors/digistore24.js se necessário.`
    );
    return firstArrayField[1];
  }

  console.warn('[digistore24] Nenhum array encontrado na resposta. Chaves disponíveis:', Object.keys(data || {}));
  return [];
}

/**
 * Normaliza uma entrada do marketplace para o formato esperado por
 * discovery/service.js#upsertProducts. Nomes de campo são best-guess — ajustar
 * conforme a resposta real (ver aviso no topo do arquivo).
 */
function normalizeEntry(entry) {
  return {
    externalId: String(entry.product_id ?? entry.id ?? entry.marketplace_entry_id ?? ''),
    name: entry.product_name ?? entry.name ?? entry.headline ?? '(nome não identificado)',
    category: entry.category ?? entry.product_category ?? null,
    price: parseNumeric(entry.price ?? entry.product_price),
    commissionType: entry.commission_type ?? (entry.commission_percent != null ? 'percentage' : 'flat'),
    commissionValue: parseNumeric(entry.commission_amount ?? entry.commission_percent ?? entry.commission),
    epc: parseNumeric(entry.epc ?? entry.earnings_per_click),
    conversionRate: parseNumeric(entry.conversion_rate ?? entry.cart_conversion),
    countriesAllowed: entry.countries ?? entry.allowed_countries ?? [],
    salesPageUrl: entry.salespage_url ?? entry.sales_page_url ?? entry.url ?? null,
  };
}

function parseNumeric(value) {
  if (value == null) return null;
  const n = Number(String(value).replace(',', '.').replace('%', ''));
  return isNaN(n) ? null : n;
}

/**
 * Busca produtos do marketplace Digistore24. `searchTerm` e `category` são
 * opcionais — sem eles, busca o marketplace geral (equivalente a abrir a página
 * de Marketplace sem filtro).
 */
async function fetchMarketplaceProducts({ searchTerm = null, pageNo = 1, pageSize = 50 } = {}) {
  const params = { page_no: pageNo, page_size: pageSize };
  if (searchTerm) params['search[name]'] = searchTerm;

  const data = await callFunction('listMarketplaceEntries', params);
  const entries = extractEntries(data);

  return entries.map(normalizeEntry).filter(p => p.externalId); // descarta entradas sem ID identificável
}

module.exports = { fetchMarketplaceProducts };
