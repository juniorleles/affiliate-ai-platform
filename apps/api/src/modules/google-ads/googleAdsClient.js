const { GoogleAdsApi } = require('google-ads-api');

function getCustomer() {
  const requiredVars = [
    'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID',
  ];
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length) {
    throw new Error(`Credenciais do Google Ads ausentes no .env: ${missing.join(', ')}`);
  }

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  return client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });
}

async function fetchCampaignMetrics() {
  const customer = getCustomer();

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

/**
 * Retorna o código de moeda da conta (ex: 'BRL', 'USD', 'EUR') — necessário
 * pra comparar CPC de leilão com valores de comissão em outra moeda sem
 * comparar maçã com laranja (bug real encontrado em 2026-08-04, ver
 * docs/ARQUITETURA.md).
 */
async function fetchAccountCurrency() {
  const customer = getCustomer();
  const rows = await customer.query('SELECT customer.currency_code FROM customer LIMIT 1');
  return rows?.[0]?.customer?.currency_code ?? null;
}

module.exports = { fetchCampaignMetrics, fetchAccountCurrency };
