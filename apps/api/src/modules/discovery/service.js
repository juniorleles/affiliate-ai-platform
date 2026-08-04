// MÓDULO: discovery (Módulo 1 do documento original)
// Status: connector Digistore24 implementado (Fase 2), mas com um bloqueio
// conhecido: a função listMarketplaceEntries da API retorna vazio mesmo com
// produtos reais disponíveis (ver docs/ARQUITETURA.md, Fase 2, nota). Enquanto
// isso não é resolvido com o suporte do Digistore24, addManualProduct() serve
// de fallback pra alimentar o pipeline com dados reais copiados manualmente.
//
// Desde 2026-08-04 (reorientação estratégica, seção 1 do doc de arquitetura),
// addManualProduct/Bulk também aceita campos opcionais de Compliance (5.3) e
// Auditoria de LP (5.4) — você já está olhando o produto no momento do
// cadastro, então custa pouco registrar isso junto.

const pool = require('../../shared/db/pool');
const { evaluateEconomics } = require('../market-intel/economics');
const digistore24 = require('./connectors/digistore24');
const compliance = require('./compliance');
const lpAudit = require('./lpAudit');

const CONNECTORS = {
  digistore24: digistore24,
  // clickbank: require('./connectors/clickbank'),  // bloqueado — ver ARQUITETURA.md
  // cj: require('./connectors/cj'),                // Fase 5
};

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
           name = EXCLUDED.name, price = EXCLUDED.price,
           commission_value = EXCLUDED.commission_value, epc = EXCLUDED.epc,
           conversion_rate = EXCLUDED.conversion_rate, currency = EXCLUDED.currency,
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

async function findProductId(networkId, externalId) {
  const { rows } = await pool.query(
    'SELECT id FROM products WHERE network_id = $1 AND external_id = $2',
    [networkId, externalId]
  );
  return rows[0]?.id ?? null;
}

/**
 * Roda o motor de Economics (5.1) pra um produto já gravado e persiste o
 * resultado. Compartilhado entre syncNetwork() e addManualProduct().
 */
async function evaluateAndStoreEconomics(networkId, product, minCommission) {
  const productId = await findProductId(networkId, product.externalId);
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
 * Sincroniza uma rede: busca produtos via connector, grava no banco, e já roda
 * cada produto pelo motor de Economics (5.1), gravando o resultado. Não chama
 * IA nenhuma aqui — isso é Fase 3b.
 */
async function syncNetwork(networkType, { searchTerm, minCommission } = {}) {
  const connector = CONNECTORS[networkType];
  if (!connector) {
    throw new Error(`Connector não implementado para a rede "${networkType}". Redes disponíveis: ${Object.keys(CONNECTORS).join(', ')}`);
  }

  const network = await findOrCreateNetwork(networkType, networkType);
  const products = await connector.fetchMarketplaceProducts({ searchTerm });

  await upsertProducts(network.id, products);

  const results = [];
  for (const p of products) {
    const result = await evaluateAndStoreEconomics(network.id, p, minCommission);
    if (result) results.push(result);
  }

  return { synced: products.length, network: network.name, economics: results };
}

/**
 * Cadastra 1 produto manualmente. Roda o pipeline de upsert + Economics, e
 * OPCIONALMENTE Compliance (5.3, classificação de nicho via IA) e Auditoria
 * de LP (5.4, registro manual — ver decisão seção 10 item 6 do doc).
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
  const productId = await findProductId(network.id, product.externalId);

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

module.exports = { upsertProducts, syncNetwork, addManualProduct, addManualProductsBulk, findOrCreateNetwork };
