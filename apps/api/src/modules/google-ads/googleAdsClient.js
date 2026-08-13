const { GoogleAdsApi } = require('google-ads-api');

// Achado real (2026-08-06): o recurso `customer_client` devolve `status` como
// código NUMÉRICO bruto (ex: 2), diferente de `customer.status` (usado em
// fetchAccountStatus abaixo), que já vem como string ('ENABLED', 'SUSPENDED'
// etc.) — mesma lib, resource diferente, serialização diferente. Sem tradução,
// isso quebrava silenciosamente a detecção de conta crítica em outros lugares
// do código (que comparam string, ex: `['SUSPENDED', ...].includes(status)`).
// Valores conferem com o enum oficial CustomerStatus da API do Google Ads.
const CUSTOMER_STATUS_ENUM = {
  0: 'UNSPECIFIED', 1: 'UNKNOWN', 2: 'ENABLED', 3: 'CANCELED', 4: 'SUSPENDED', 5: 'CLOSED',
};
function normalizeCustomerStatus(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string' && isNaN(Number(raw))) return raw; // já veio como string (ex: customer.status)
  return CUSTOMER_STATUS_ENUM[Number(raw)] ?? String(raw);
}

// Cliente reaproveitado entre chamadas — a credencial de app (client_id/secret/
// developer_token) é sempre a mesma, só customer_id/refresh_token/login_customer_id
// mudam por conta (Fase 7, suporte multi-conta, 2026-08-05).
let sharedClient = null;
function getClient() {
  if (sharedClient) return sharedClient;

  const requiredVars = ['GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_DEVELOPER_TOKEN'];
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length) {
    throw new Error(`Credenciais do Google Ads ausentes no .env: ${missing.join(', ')}`);
  }

  sharedClient = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });
  return sharedClient;
}

/**
 * Monta o cliente pra uma conta específica. `account` é opcional — sem ele,
 * cai pro comportamento antigo (conta única via .env), pra não quebrar nada
 * que já funciona. Com `account` (linha de `google_ads_accounts`), usa os
 * dados daquela conta específica — suporte multi-conta, Fase 7.
 */
function getCustomer(account) {
  const customerId = account?.customer_id || process.env.GOOGLE_ADS_CUSTOMER_ID;
  const loginCustomerId = account?.login_customer_id || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined;
  const refreshToken = account?.refresh_token || process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (!customerId || !refreshToken) {
    throw new Error('customer_id e refresh_token são obrigatórios (via conta específica ou .env).');
  }

  return getClient().Customer({
    customer_id: customerId,
    login_customer_id: loginCustomerId,
    refresh_token: refreshToken,
  });
}

async function fetchCampaignMetrics(account) {
  const customer = getCustomer(account);

  const rows = await customer.query(`
    SELECT
      campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
      segments.date,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY segments.date ASC
  `);

  return rows.map(r => ({
    campaignId: String(r.campaign.id),
    campaignName: r.campaign.name,
    status: r.campaign.status,
    channelType: r.campaign.advertising_channel_type,
    date: r.segments.date,
    impressions: r.metrics.impressions || 0,
    clicks: r.metrics.clicks || 0,
    cost: (r.metrics.cost_micros || 0) / 1_000_000,
    conversions: r.metrics.conversions || 0,
    conversionsValue: r.metrics.conversions_value || 0,
  }));
}

async function fetchAccountCurrency(account) {
  const customer = getCustomer(account);
  const rows = await customer.query('SELECT customer.currency_code FROM customer LIMIT 1');
  return rows?.[0]?.customer?.currency_code ?? null;
}

/**
 * Status real da conta (Fase 7, Parte A — detecção de suspensão). GAQL não
 * expõe "suspended" como um campo simples e universal em todas as versões da
 * API — usamos customer.status, que cobre ENABLED/CANCELED/SUSPENDED/CLOSED.
 * Se a query falhar (ex: versão da API não suporta o campo), quem chamar
 * precisa tratar isso como "não foi possível confirmar", não como "ativo".
 */
async function fetchAccountStatus(account) {
  const customer = getCustomer(account);
  const rows = await customer.query('SELECT customer.status FROM customer LIMIT 1');
  return rows?.[0]?.customer?.status ?? null;
}

/**
 * Status de aprovação de cada anúncio ativo (Fase 7, Parte A — detecção real
 * de reprovação, que a tabela `alerts` previa desde o início mas nunca tinha
 * sido implementada). Mesma ressalva de sempre: nomes de campo não 100%
 * confirmados contra conta real — parsing defensivo, loga aviso se vier
 * vazio quando não deveria.
 */
async function fetchAdApprovalStatuses(account) {
  const customer = getCustomer(account);

  const rows = await customer.query(`
    SELECT
      ad_group_ad.ad.id, ad_group_ad.status,
      ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status,
      campaign.id, campaign.name
    FROM ad_group_ad
    WHERE ad_group_ad.status != 'REMOVED'
  `);

  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn('[google-ads] fetchAdApprovalStatuses não retornou nenhum anúncio — pode ser normal (nenhum anúncio ativo) ou sinal de campo errado na query.');
    return [];
  }

  return rows.map(r => ({
    adId: String(r.ad_group_ad?.ad?.id ?? ''),
    adStatus: r.ad_group_ad?.status ?? null,
    approvalStatus: r.ad_group_ad?.policy_summary?.approval_status ?? null,
    reviewStatus: r.ad_group_ad?.policy_summary?.review_status ?? null,
    campaignId: String(r.campaign?.id ?? ''),
    campaignName: r.campaign?.name ?? null,
  })).filter(a => a.adId);
}

/**
 * Descobre a hierarquia real de contas sob uma MCC (2026-08-06, respondendo
 * a pergunta direta do usuário: "como o sistema sabe quais contas existem?").
 * API oficial: recurso `customer_client`, consultado a partir da própria MCC
 * (login_customer_id = customer_id da MCC). Confirmado via pesquisa antes de
 * implementar (mesma disciplina de sempre) — é o jeito documentado pelo
 * Google de listar hierarquia, diferente de `ListAccessibleCustomers` (que
 * só lista o que o usuário tem acesso direto, não a árvore da MCC).
 *
 * Mesma ressalva de sempre: nomes de campo não confirmados contra conta real
 * a partir deste ambiente — parsing defensivo, avisa se vier vazio.
 */
async function fetchAccountHierarchy(mccAccount) {
  // Consulta a própria MCC: customer_id E login_customer_id apontam pra ela,
  // pra ver a árvore inteira que ela gerencia.
  const asMcc = { customer_id: mccAccount.mcc_customer_id, login_customer_id: mccAccount.mcc_customer_id };
  const customer = getCustomer(asMcc);

  const rows = await customer.query(`
    SELECT
      customer_client.id, customer_client.descriptive_name, customer_client.level,
      customer_client.manager, customer_client.status, customer_client.hidden
    FROM customer_client
    WHERE customer_client.level <= 2
  `);

  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn('[google-ads] fetchAccountHierarchy não retornou nada pra MCC', mccAccount.mcc_customer_id, '— confira se o customer_id está certo e se é mesmo uma MCC.');
    return [];
  }

  const parsed = rows.map(r => ({
    customerId: String(r.customer_client?.id ?? ''),
    name: r.customer_client?.descriptive_name ?? null,
    level: r.customer_client?.level ?? null,
    isManager: !!r.customer_client?.manager,
    status: normalizeCustomerStatus(r.customer_client?.status),
    hidden: !!r.customer_client?.hidden,
  }));

  // Achado real (2026-08-06): quando a linha de nível 0 (a própria conta
  // consultada) não é `manager: true`, ela simplesmente não tem filhas —
  // isso é uma conta comum, não uma MCC de verdade. Sem essa checagem
  // explícita, o resultado virava "0 contas encontradas" sem explicação,
  // indistinguível de uma falha real. Erro claro é melhor que "0" silencioso.
  const selfRow = parsed.find(c => c.level === 0);
  if (selfRow && !selfRow.isManager) {
    throw new Error(
      `A conta ${mccAccount.mcc_customer_id} (${selfRow.name || 'sem nome'}) não é uma conta ` +
      `gerenciadora (MCC) segundo a própria API do Google — é uma conta comum, não tem sub-contas. ` +
      `Confirme se esse é realmente o customer_id da sua MCC (na UI do Google Ads, contas MCC têm um ` +
      `seletor de contas no canto superior; contas comuns não têm).`
    );
  }

  return parsed.filter(c => c.customerId && c.level !== 0); // level 0 = a própria MCC, não uma conta filha
}

module.exports = { getClient, getCustomer, fetchCampaignMetrics, fetchAccountCurrency, fetchAccountStatus, fetchAdApprovalStatuses, fetchAccountHierarchy };
