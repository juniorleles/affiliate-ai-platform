const pool = require('../../shared/db/pool');

async function upsertCampaignsAndMetrics(rows) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const row of rows) {
      const { rows: campaignRows } = await client.query(
        `INSERT INTO campaigns (google_campaign_id, name, status, channel_type, last_synced_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (google_campaign_id) DO UPDATE SET
           name = EXCLUDED.name, status = EXCLUDED.status,
           channel_type = EXCLUDED.channel_type, last_synced_at = EXCLUDED.last_synced_at
         RETURNING id`,
        [row.campaignId, row.campaignName, row.status, row.channelType]
      );
      const campaignId = campaignRows[0].id;

      await client.query(
        `INSERT INTO campaign_metrics_daily
           (campaign_id, date, impressions, clicks, cost, google_conversions, google_conversions_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (campaign_id, date) DO UPDATE SET
           impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks, cost = EXCLUDED.cost,
           google_conversions = EXCLUDED.google_conversions,
           google_conversions_value = EXCLUDED.google_conversions_value`,
        [campaignId, row.date, row.impressions, row.clicks, row.cost, row.conversions, row.conversionsValue]
      );
    }

    await client.query('COMMIT');
    return rows.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listCampaignsWithMetrics() {
  const { rows } = await pool.query(`
    SELECT
      c.id, c.google_campaign_id, c.name, c.status, c.target_cpa, c.target_roas, c.last_synced_at,
      COALESCE(SUM(m.cost), 0) AS cost_30d,
      COALESCE(SUM(m.clicks), 0) AS clicks_30d,
      COALESCE(SUM(m.impressions), 0) AS impressions_30d,
      COALESCE(SUM(m.google_conversions), 0) AS google_conversions_30d,
      COALESCE(SUM(m.google_conversions_value), 0) AS google_conversions_value_30d
    FROM campaigns c
    LEFT JOIN campaign_metrics_daily m ON m.campaign_id = c.id AND m.date >= (CURRENT_DATE - INTERVAL '30 days')
    GROUP BY c.id
    ORDER BY cost_30d DESC
  `);
  return rows;
}

async function getAffiliateStatsByCampaignName() {
  // Bug real corrigido em 2026-08-06: SELECT usava cl.utm_campaign (bruto),
  // GROUP BY usava LOWER(cl.utm_campaign) (transformado) — Postgres exige que
  // toda coluna não-agregada no SELECT bata exatamente com a expressão do
  // GROUP BY. Corrigido usando LOWER() nos dois lugares (mantém o
  // agrupamento case-insensitive, que é o comportamento pretendido — ver
  // getAffiliateStatsForCampaign logo abaixo, que já compara com LOWER()).
  const { rows } = await pool.query(`
    SELECT LOWER(cl.utm_campaign) AS campaign_name,
      COUNT(DISTINCT cv.id) AS conversions,
      COALESCE(SUM(cv.value), 0) AS revenue
    FROM clicks cl
    JOIN conversions cv ON cv.click_id = cl.id AND cv.status != 'rejected'
    WHERE cl.utm_campaign IS NOT NULL
    GROUP BY LOWER(cl.utm_campaign)
  `);
  return rows;
}

async function getAffiliateStatsForCampaign(campaignName) {
  const { rows } = await pool.query(`
    SELECT COUNT(DISTINCT cv.id) AS conversions, COALESCE(SUM(cv.value), 0) AS revenue
    FROM clicks cl
    JOIN conversions cv ON cv.click_id = cl.id AND cv.status != 'rejected'
    WHERE LOWER(cl.utm_campaign) = LOWER($1)
  `, [campaignName]);
  return rows[0];
}

async function getLatestAnalysesByCampaign() {
  const { rows } = await pool.query(`
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY subject_id ORDER BY created_at DESC) AS rn
      FROM ai_analyses WHERE subject_type = 'campaign'
    ) t WHERE rn = 1
  `);
  return rows;
}

async function findCampaignById(id) {
  const { rows } = await pool.query('SELECT * FROM campaigns WHERE id = $1', [id]);
  return rows[0] || null;
}

async function updateCampaignTargets(id, { targetCpa, targetRoas }) {
  const { rows } = await pool.query(
    `UPDATE campaigns SET
       target_cpa = COALESCE($2, target_cpa),
       target_roas = COALESCE($3, target_roas)
     WHERE id = $1 RETURNING *`,
    [id, targetCpa ?? null, targetRoas ?? null]
  );
  return rows[0] || null;
}

async function getDailyMetrics(campaignId) {
  const { rows } = await pool.query(`
    SELECT date, impressions, clicks, cost, google_conversions, google_conversions_value
    FROM campaign_metrics_daily
    WHERE campaign_id = $1 AND date >= (CURRENT_DATE - INTERVAL '30 days')
    ORDER BY date ASC
  `, [campaignId]);
  return rows;
}

async function listAllCampaigns() {
  const { rows } = await pool.query('SELECT * FROM campaigns');
  return rows;
}

async function insertKeywordMetrics(productId, ideas, source = 'generic') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const idea of ideas) {
      await client.query(
        `INSERT INTO keyword_metrics
           (product_id, keyword_text, avg_monthly_searches, competition_level,
            competition_index, top_of_page_bid_low, top_of_page_bid_high, research_source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [productId, idea.keywordText, idea.avgMonthlySearches, idea.competitionLevel,
          idea.competitionIndex, idea.topOfPageBidLow, idea.topOfPageBidHigh, source]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getLatestKeywordMetrics(productId) {
  // Limite subiu de 20 pra 200 (2026-08-05) — com a pesquisa de intenção
  // comercial (múltiplos seeds), o pool de candidatos por produto cresce bem
  // além de 20, e o antigo limite cortava opções de fundo de funil sem avisar.
  const { rows } = await pool.query(
    'SELECT * FROM keyword_metrics WHERE product_id = $1 ORDER BY captured_at DESC LIMIT 200',
    [productId]
  );
  return rows;
}

/**
 * Idempotência do Decision Engine (2026-08-06): confirma se uma pesquisa de
 * determinada origem (`generic` | `commercial_intent`) já rodou pra esse
 * produto, sem precisar trazer as linhas inteiras.
 */
async function hasKeywordResearchSource(productId, source) {
  const { rows } = await pool.query(
    'SELECT 1 FROM keyword_metrics WHERE product_id = $1 AND research_source = $2 LIMIT 1',
    [productId, source]
  );
  return rows.length > 0;
}

// --- Contas do Google Ads (Fase 7, suporte multi-conta, 2026-08-05) ---

async function listAccounts() {
  const { rows } = await pool.query('SELECT * FROM google_ads_accounts ORDER BY is_default DESC, name');
  return rows;
}

async function findAccountById(id) {
  const { rows } = await pool.query('SELECT * FROM google_ads_accounts WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createAccount({
  customerId, name, loginCustomerId, isDefault,
  mccId, operacao, marca, regiao, dominio, paymentMethodLabel, dailyBudgetCap,
}) {
  const { rows } = await pool.query(
    `INSERT INTO google_ads_accounts
       (customer_id, name, login_customer_id, is_default, mcc_id, operacao, marca,
        regiao, dominio, payment_method_label, daily_budget_cap)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      customerId, name || null, loginCustomerId || null, !!isDefault,
      mccId || null, operacao || null, marca || null, regiao || null,
      dominio || null, paymentMethodLabel || null, dailyBudgetCap || null,
    ]
  );
  return rows[0];
}

async function updateAccountStatus(id, status) {
  // Guarda o status anterior antes de sobrescrever — checkAccountStatusChanges()
  // (monitoring) usa isso pra só alertar em MUDANÇA, não repetir alerta a cada
  // checagem de 15 em 15 minutos enquanto o status continuar igual.
  const { rows } = await pool.query(
    `UPDATE google_ads_accounts
     SET previous_status = status, status = $2, last_status_check_at = now()
     WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return rows[0] || null;
}

/**
 * Usada só por syncAccountsFromMcc() — diferente de updateAccountStatus()
 * (que só toca status, usada pelo monitoring), essa também corrige `mcc_id`.
 * Achado real (2026-08-06): uma conta cadastrada antes de sabermos qual era
 * a MCC de verdade (ex: cadastrada com `mcc_id` apontando pra uma "MCC" que
 * na real não é gerenciadora) nunca tinha o parentesco corrigido depois —
 * sync só atualizava status, deixando a hierarquia errada pra sempre até
 * alguém editar na mão.
 */
async function updateAccountFromSync(id, { status, mccId }) {
  const { rows } = await pool.query(
    `UPDATE google_ads_accounts
     SET previous_status = status, status = $2, last_status_check_at = now(), mcc_id = $3
     WHERE id = $1 RETURNING *`,
    [id, status, mccId]
  );
  return rows[0] || null;
}

/**
 * Exclusão de conta (2026-08-06) — não existia até agora, só criar/listar.
 * Uso real: limpar dado de teste/fake, ou remover conta que fechou de vez.
 * Sem soft-delete por ora (escopo pequeno, dezenas de contas — se isso virar
 * um problema real, trocar por is_active + filtro, não agora).
 */
async function deleteAccount(id) {
  const { rows } = await pool.query('DELETE FROM google_ads_accounts WHERE id = $1 RETURNING *', [id]);
  return rows[0] || null;
}

// --- MCCs (governança "guarda-chuva", 2026-08-05) ---

async function listMccs() {
  const { rows } = await pool.query('SELECT * FROM google_mccs ORDER BY name');
  return rows;
}

async function createMcc({ mccCustomerId, name, parentMccId, notes }) {
  const { rows } = await pool.query(
    'INSERT INTO google_mccs (mcc_customer_id, name, parent_mcc_id, notes) VALUES ($1,$2,$3,$4) RETURNING *',
    [mccCustomerId, name, parentMccId || null, notes || null]
  );
  return rows[0];
}

/**
 * Exclusão de MCC. Falha com erro de FK se ainda tiver conta apontando pra
 * ela (google_ads_accounts.mcc_id) — de propósito, sem CASCADE: melhor um
 * erro claro pedindo pra reparentar/excluir as contas primeiro do que apagar
 * silenciosamente o vínculo de uma conta real por engano.
 */
async function deleteMcc(id) {
  const { rows } = await pool.query('DELETE FROM google_mccs WHERE id = $1 RETURNING *', [id]);
  return rows[0] || null;
}

/**
 * Visão de governança: agrupa contas por MCC, operação, e método de pagamento
 * — pra você enxergar "quantas contas dependem do mesmo método de pagamento"
 * (blast radius se ele falhar) sem precisar contar manualmente.
 */
/**
 * Visão de governança: agrupa contas por MCC, operação, e método de pagamento
 * — pra você enxergar "quantas contas dependem do mesmo método de pagamento"
 * (blast radius se ele falhar) sem precisar contar manualmente.
 *
 * Fase 10 (2026-08-06): cada conta ganha `health` (green/yellow/red) —
 * combina status real da conta (Google Ads) + alertas abertos vinculados a
 * ela (subject_type='account'). Cálculo determinístico, sem IA — mesmo
 * princípio do resto do projeto ("calculável primeiro").
 */
async function getGovernanceRollup() {
  const { rows: accounts } = await pool.query(`
    SELECT a.*, m.name AS mcc_name,
      (SELECT COUNT(*) FROM alerts al
       WHERE al.subject_type = 'account' AND al.subject_id = a.id AND al.status = 'open') AS open_alerts_count
    FROM google_ads_accounts a
    LEFT JOIN google_mccs m ON m.id = a.mcc_id
  `);

  const byPaymentMethod = {};
  const byOperacao = {};
  const byStatus = {};
  const byHealth = { green: 0, yellow: 0, red: 0 };

  for (const acc of accounts) {
    const pm = acc.payment_method_label || '(sem rótulo)';
    const op = acc.operacao || '(sem operação)';
    byPaymentMethod[pm] = (byPaymentMethod[pm] || 0) + 1;
    byOperacao[op] = (byOperacao[op] || 0) + 1;
    byStatus[acc.status] = (byStatus[acc.status] || 0) + 1;

    const concerning = ['SUSPENDED', 'CANCELED', 'CLOSED'].includes(acc.status);
    const openAlerts = Number(acc.open_alerts_count) || 0;
    acc.health = concerning ? 'red' : openAlerts > 0 ? 'yellow' : 'green';
    byHealth[acc.health]++;
  }

  return { accounts, totalAccounts: accounts.length, byPaymentMethod, byOperacao, byStatus, byHealth };
}

module.exports = {
  upsertCampaignsAndMetrics,
  listCampaignsWithMetrics,
  getAffiliateStatsByCampaignName,
  getAffiliateStatsForCampaign,
  getLatestAnalysesByCampaign,
  findCampaignById,
  updateCampaignTargets,
  getDailyMetrics,
  listAllCampaigns,
  insertKeywordMetrics,
  getLatestKeywordMetrics,
  hasKeywordResearchSource,
  listAccounts,
  findAccountById,
  listMccs,
  createMcc,
  deleteMcc,
  getGovernanceRollup,
  createAccount,
  updateAccountStatus,
  updateAccountFromSync,
  deleteAccount,
};
