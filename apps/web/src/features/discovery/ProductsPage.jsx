import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import QuickAddModal from './QuickAddModal';
import LpAuditModal from './LpAuditModal';
import BulkAddModal from './BulkAddModal';

const ECONOMICS_LABELS = {
  viavel: 'Viável',
  rejeitado_por_economics: 'Rejeitado (leilão)',
  rejeitado_por_comissao_minima: 'Comissão baixa',
  dado_insuficiente: 'Dado insuficiente',
  erro_avaliacao: 'Erro na avaliação',
};

const NICHE_LABELS = { normal: 'Nicho normal', sensitive: 'Nicho sensível', black: 'Nicho black' };

function fmtMoney(v, currency) {
  if (v == null) return '—';
  return `${currency || ''} ${Number(v).toFixed(2)}`.trim();
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [lpAuditProduct, setLpAuditProduct] = useState(null);

  async function loadProducts() {
    setLoading(true);
    try {
      const data = await api.get('/products');
      setProducts(data.products);
    } catch (err) {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProducts(); }, []);

  function handleSaved(closeFn) {
    closeFn(null);
    loadProducts();
  }

  return (
    <>
      <div className="products-toolbar">
        <h2 style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.05rem' }}>Produtos</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setShowBulkAdd(true)}>Cadastro em lote</button>
          <button className="btn btn-primary" onClick={() => setShowQuickAdd(true)}>+ Adicionar produto</button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : products.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            Nenhum produto cadastrado ainda. Clique em "+ Adicionar produto" pra começar —
            leva menos de 1 minuto pra registrar os dados essenciais.
          </div>
        </div>
      ) : (
        <div className="products-grid">
          {products.map(p => {
            const lpPending = p.lp_audited_at == null;
            return (
              <div className="product-card" key={p.id}>
                <div className="product-card-header">
                  <div>
                    <div className="product-card-title">{p.name}</div>
                    <div className="product-card-network">{p.network_name}{p.category ? ` · ${p.category}` : ''}</div>
                  </div>
                </div>

                <div className="product-card-metrics">
                  <div>
                    <span>Comissão</span>
                    {fmtMoney(p.commission_value, p.currency)}
                  </div>
                  <div>
                    <span>CPC máx.</span>
                    {fmtMoney(p.cpc_maximo_calculado, p.currency)}
                  </div>
                </div>

                <div className="product-card-badges">
                  {p.economics_status && (
                    <span className={`verdict ${p.economics_status}`}>
                      {ECONOMICS_LABELS[p.economics_status] || p.economics_status}
                    </span>
                  )}
                  {p.niche_sensitivity && (
                    <span className={`badge ${p.niche_sensitivity === 'normal' ? 'active' : p.niche_sensitivity === 'sensitive' ? 'paused' : 'blocked'}`}>
                      {NICHE_LABELS[p.niche_sensitivity] || p.niche_sensitivity}
                    </span>
                  )}
                  {lpPending && <span className="pending-badge">Auditoria de LP pendente</span>}
                </div>

                <div className="product-card-actions">
                  <button className="btn" onClick={() => setLpAuditProduct(p)}>
                    {lpPending ? 'Auditar página' : 'Editar auditoria'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showQuickAdd && (
        <QuickAddModal
          onClose={() => setShowQuickAdd(false)}
          onSaved={() => handleSaved(setShowQuickAdd)}
        />
      )}

      {showBulkAdd && (
        <BulkAddModal
          onClose={() => setShowBulkAdd(false)}
          onSaved={() => handleSaved(setShowBulkAdd)}
        />
      )}

      {lpAuditProduct && (
        <LpAuditModal
          product={lpAuditProduct}
          onClose={() => setLpAuditProduct(null)}
          onSaved={() => handleSaved(setLpAuditProduct)}
        />
      )}
    </>
  );
}
