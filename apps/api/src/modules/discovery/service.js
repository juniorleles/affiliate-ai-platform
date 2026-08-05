// MÓDULO: discovery (Módulo 1 do documento original)
//
// Descoberta automática de produtos via API de rede de afiliados foi REMOVIDA
// do escopo do projeto em 2026-08-04 (decisão do usuário, formalizada em
// docs/ARQUITETURA.md seção 1 e Fase 2). Motivo: confirmado com a Digistore24
// (função de API existente lista só produtos do PRÓPRIO vendedor, não o
// marketplace geral) e com a ClickBank (Termos de Uso proíbem scraping
// explicitamente, mesmo via terceiro) que a maioria das redes não permite
// isso. Cadastro manual (addManualProduct / addManualProductsBulk) é o único
// caminho de Discovery — e é definitivo, não um fallback temporário.
//
// Desde 2026-08-04, addManualProduct/Bulk também aceita campos opcionais de
// Compliance (5.3) e Auditoria de LP (5.4) — você já está olhando o produto
// no momento do cadastro, então custa pouco registrar isso junto.

const pool = require('../../shared/db/pool');
const { evaluateEconomics } = require('../market-intel/economics');
const compliance = require('./compliance');
const lpAudit = require('./lpAudit');

async function upsertProducts(networkId, products) {
  // Formato esperado de cada item em `products`:
  // { externalId, name, category, price, commissionType, commissionValue,
  //   epc, conversionRate, countriesAllowed, salesPageUrl, currency }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of products) {
      const { rows } = await client.query(
        `INSERT INTO products
           (network_id, external_id, name, category, price, commission_type, commission_value,
            epc, conversion_rate, countries_allowed, sales_page_url, currency, last_seen_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
         ON CONFLICT (network_id, external_id) DO UPDATE SET
           name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price,
           commission_value = EXCLUDED.commission_value, epc = EXCLUDED.epc,
           conversion_rate = EXCLUDED.conversion_rate, currency = EXCLUDED.currency,
           sales_page_url = COALESCE(EXCLUDED.sales_page_url, products.sales_page_url),
           countries_allowed = EXCLUDED.countries_allowed,
           last_seen_at = now()
         RETURNING id`,
        [networkId, p.externalId, p.name, p.category, p.price, p.commissionType,
          p.commissionValue, p.epc, p.conversionRate, JSON.stringify(p.countriesAllowed || []),
          p.salesPageUrl, p.currency || 'EUR']
      );
      const productId = rows[0].id;
      await client.query(
        `INSERT INTO product_snapshots (product_id, price, commission_value, epc, conversion_rate)
         VALUES ($1, $2, $3, $4, $5)`,
        [productId, p.price, p.commissionValue, p.epc, p.conversionRate]
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

async function findOrCreateNetwork(type, name) {
  const { rows } = await pool.query('SELECT * FROM networks WHERE type = $1', [type]);
  if (rows[0]) return rows[0];

  const inserted = await pool.query(
    `INSERT INTO networks (name, type, status) VALUES ($1, $2, 'active') RETURNING *`,
    [name, type]
  );
  return inserted.rows[0];
}

/**
 * Roda o motor de Economics (5.1) pra um produto já gravado e persiste o
 * resultado. Compartilhado entre addManualProduct() e addManualProductsBulk().
 */
async function evaluateAndStoreEconomics(networkId, product, minCommission) {
  const { rows } = await pool.query(
    'SELECT id FROM products WHERE network_id = $1 AND external_id = $2',
    [networkId, product.externalId]
  );
  const productId = rows[0]?.id ?? null;
  if (!productId) return null;

  let economics;
  try {
    economics = evaluateEconomics({
      comissaoEsperada: product.commissionValue,
      taxaConversaoEsperada: product.conversionRate ?? 0,
      comissaoMinima: minCommission,
    });
  } catch (err) {
    economics = { status: 'erro_avaliacao', motivo: err.message };
  }

  await pool.query(
    `INSERT INTO product_economics
       (product_id, comissao_usada, taxa_conversao_esperada, cpc_maximo_calculado,
        comissao_minima_ok, status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      productId, product.commissionValue, product.conversionRate ?? 0,
      economics.cpcMaximoCalculado ?? null, economics.comissaoMinimaOk ?? null, economics.status,
    ]
  );

  return { product: product.name, status: economics.status };
}

/**
 * Cadastra 1 produto manualmente — único caminho de Discovery (ver nota no
 * topo do arquivo). Roda o pipeline de upsert + Economics, e OPCIONALMENTE
 * Compliance (5.3, classificação de nicho via IA) e Auditoria de LP (5.4,
 * registro manual — ver decisão seção 10 item 6 do doc).
 *
 * Campos extras opcionais no input:
 * - description: usado como contexto pra classificação de nicho da IA
 * - allowsBrandBidding, allowsBottomFunnel, requiresPresell: fatos objetivos de compliance
 * - hasCta, hasVsl, affiliateParamsPreserved, loadTimeMs, offerClarityScore, lpNotes: auditoria de LP
 * - skipCompliance: true pra pular a chamada de IA (ex: cadastro em lote grande, roda depois)
 */
async function addManualProduct(input) {
  const {
    networkType, externalId, name, category, price, description,
    commissionType, commissionValue, epc, conversionRate, currency,
    countriesAllowed, salesPageUrl, minCommission,
    allowsBrandBidding, allowsBottomFunnel, requiresPresell,
    hasCta, hasVsl, affiliateParamsPreserved, loadTimeMs, offerClarityScore, lpNotes,
    skipCompliance,
  } = input;

  if (!networkType || !externalId || !name) {
    throw new Error('networkType, externalId e name são obrigatórios.');
  }
  if (commissionValue == null || isNaN(commissionValue)) {
    throw new Error('commissionValue é obrigatório e deve ser numérico.');
  }

  const network = await findOrCreateNetwork(networkType, networkType);

  const product = {
    externalId: String(externalId),
    name,
    category: category ?? null,
    price: price ?? null,
    commissionType: commissionType ?? 'flat',
    commissionValue: Number(commissionValue),
    epc: epc ?? null,
    conversionRate: conversionRate != null ? Number(conversionRate) : 0,
    countriesAllowed: countriesAllowed ?? [],
    salesPageUrl: salesPageUrl ?? null,
    currency: currency ?? 'EUR',
  };

  await upsertProducts(network.id, [product]);
  const economics = await evaluateAndStoreEconomics(network.id, product, minCommission);
  const productRow = await pool.query(
    'SELECT id FROM products WHERE network_id = $1 AND external_id = $2',
    [network.id, product.externalId]
  );
  const productId = productRow.rows[0]?.id ?? null;

  let complianceResult = null;
  if (!skipCompliance) {
    complianceResult = await compliance.evaluateCompliance(productId, { name, category, description }, {
      allowsBrandBidding, allowsBottomFunnel, requiresPresell,
    });
  }

  let lpAuditResult = null;
  if (hasCta != null || hasVsl != null || affiliateParamsPreserved != null || loadTimeMs != null || offerClarityScore != null || lpNotes) {
    lpAuditResult = await lpAudit.recordAudit(productId, {
      hasCta, hasVsl, affiliateParamsPreserved, loadTimeMs, offerClarityScore, notes: lpNotes,
    });
  }

  return { product, economics, compliance: complianceResult, lpAudit: lpAuditResult };
}

/**
 * Versão em lote de addManualProduct — aceita um array de produtos. Continua
 * mesmo se um item falhar (retorna o erro daquele item específico), pra um
 * produto malformado não travar o lote inteiro.
 */
async function addManualProductsBulk(products, { minCommission } = {}) {
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('products deve ser um array com pelo menos 1 item.');
  }

  const results = [];
  for (const p of products) {
    try {
      const result = await addManualProduct({ ...p, minCommission: p.minCommission ?? minCommission });
      results.push({ ok: true, name: p.name, ...result });
    } catch (err) {
      results.push({ ok: false, name: p.name, error: err.message });
    }
  }

  return {
    total: products.length,
    sucesso: results.filter(r => r.ok).length,
    falha: results.filter(r => !r.ok).length,
    results,
  };
}

module.exports = { upsertProducts, addManualProduct, addManualProductsBulk, findOrCreateNetwork };
