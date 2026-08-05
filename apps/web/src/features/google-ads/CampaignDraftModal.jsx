import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function CampaignDraftModal({ onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [name, setName] = useState('');
  const [dailyBudget, setDailyBudget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/products').then(data => setProducts(data.products)).catch(() => setProducts([]));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!productId || !name.trim() || !dailyBudget) {
      setError('Produto, nome da campanha e orçamento diário são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/campaigns/drafts', {
        productId: Number(productId),
        name: name.trim(),
        dailyBudget: Number(dailyBudget),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Novo rascunho de campanha</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: -8, marginBottom: 16 }}>
          A IA já sugere palavras-chave (do que já pesquisamos) e copy de anúncio
          (headlines/descrições), checando correspondência com a página de vendas.
          Você revisa e cria a campanha manualmente no Google Ads depois.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field field-full">
            <label>Produto *</label>
            <select value={productId} onChange={e => setProductId(e.target.value)}>
              <option value="">Selecione...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Nome da campanha *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Amino Formula - Search" />
            </div>
            <div className="field">
              <label>Orçamento diário *</label>
              <input type="number" step="0.01" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)} placeholder="Máx. 100" />
            </div>
          </div>

          {error && <div className="form-msg error">{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Gerando rascunho...' : 'Gerar rascunho'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
