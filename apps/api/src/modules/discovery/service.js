// MÓDULO: discovery (Módulo 1 do documento original)
// Status: STUB — schema já existe (migration 005_discovery.sql), implementação
// entra na Fase 2 (ver docs/ARQUITETURA.md seção 8).
//
// Quando for implementar:
// - 1 arquivo `<rede>.connector.js` por rede de afiliados (digistore24, clickbank, ...),
//   todos implementando a mesma interface: fetchProducts() → retorna array normalizado
//   igual ao formato usado em upsertProducts() abaixo.
// - Comece por UMA rede só (a decisão de qual foi deixada em aberto na seção 8 do
//   documento de arquitetura — "a que você mais usa"), prove o pipeline, só depois
//   multiplique.

const pool = require('../../shared/db/pool');

async function upsertProducts(networkId, products) {
  // Formato esperado de cada item em `products`:
  // { externalId, name, category, price, commissionType, commissionValue,
  //   epc, conversionRate, countriesAllowed, salesPageUrl }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of products) {
      const { rows } = await client.query(
        `INSERT INTO products
           (network_id, external_id, name, category, price, commission_type, commission_value,
            epc, conversion_rate, countries_allowed, sales_page_url, last_seen_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
         ON CONFLICT (network_id, external_id) DO UPDATE SET
           name = EXCLUDED.name, price = EXCLUDED.price,
           commission_value = EXCLUDED.commission_value, epc = EXCLUDED.epc,
           conversion_rate = EXCLUDED.conversion_rate, last_seen_at = now()
         RETURNING id`,
        [networkId, p.externalId, p.name, p.category, p.price, p.commissionType,
          p.commissionValue, p.epc, p.conversionRate, JSON.stringify(p.countriesAllowed || []), p.salesPageUrl]
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

async function syncNetwork(networkId) {
  throw new Error(
    'Não implementado ainda. Ver docs/ARQUITETURA.md Fase 2 — implemente o connector ' +
    'da rede de afiliados escolhida e chame upsertProducts() com o resultado.'
  );
}

module.exports = { upsertProducts, syncNetwork };
