import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import MarketIntelDetail from './MarketIntelDetail';

export default function MarketIntelPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openProduct, setOpenProduct] = useState(null);

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

  return (
    <>
      <div className="products-toolbar">
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.05rem' }}>Inteligência de Mercado</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Score determinístico (demanda, competição, qualidade de LP) + as 8 perguntas
            da IA sobre cada produto: vale a pena anunciar, com que orçamento, quais riscos.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : products.length === 0 ? (
        <div className="panel">
          <div className="empty-state">Nenhum produto cadastrado ainda. Cadastre pela aba "Produtos" primeiro.</div>
        </div>
      ) : (
        <div className="products-grid">
          {products.map(p => (
            <div className="product-card" key={p.id} onClick={() => setOpenProduct(p)} style={{ cursor: 'pointer' }}>
              <div className="product-card-header">
                <div>
                  <div className="product-card-title">{p.name}</div>
                  <div className="product-card-network">{p.network_name}</div>
                </div>
              </div>
              <div className="product-card-badges">
                {p.economics_status && <span className={`verdict ${p.economics_status}`}>{p.economics_status}</span>}
              </div>
              <div className="product-card-actions">
                <button className="btn">Ver análise de oportunidade</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {openProduct && (
        <MarketIntelDetail product={openProduct} onClose={() => setOpenProduct(null)} />
      )}
    </>
  );
}
