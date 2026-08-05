import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function CompetitorAdModal({ onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [competitorName, setCompetitorName] = useState('');
  const [competitorDomain, setCompetitorDomain] = useState('');
  const [productId, setProductId] = useState('');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/products').then(data => setProducts(data.products)).catch(() => setProducts([]));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!competitorName.trim() || !headline.trim()) {
      setError('Nome do concorrente e headline do anúncio são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/competitive-intel/manual', {
        competitorName: competitorName.trim(),
        competitorDomain: competitorDomain.trim() || null,
        productId: productId || null,
        platform: 'google_ads',
        headline: headline.trim(),
        body: body.trim() || null,
        landingPageUrl: landingPageUrl.trim() || null,
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
          <h2>Anúncio de concorrente</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: -8, marginBottom: 16 }}>
          Copie os dados de <a href="https://adstransparency.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--green)' }}>adstransparency.google.com</a> —
          busque pelo nome ou domínio do concorrente e cole o que encontrar aqui.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Nome do concorrente *</label>
              <input value={competitorName} onChange={e => setCompetitorName(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Domínio</label>
              <input value={competitorDomain} onChange={e => setCompetitorDomain(e.target.value)} placeholder="exemplo.com" />
            </div>
          </div>

          <div className="field field-full">
            <label>Vincular a um produto seu (opcional)</label>
            <select value={productId} onChange={e => setProductId(e.target.value)}>
              <option value="">Nenhum específico</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="field field-full">
            <label>Headline do anúncio *</label>
            <input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Ex: Best Amino Acid Supplement - 20% Off" />
          </div>

          <div className="field field-full">
            <label>Descrição do anúncio</label>
            <textarea rows={2} value={body} onChange={e => setBody(e.target.value)}
              style={{ width: '100%', background: 'var(--panel-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', color: 'var(--text)', fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', resize: 'vertical' }} />
          </div>

          <div className="field field-full">
            <label>URL da landing page do concorrente</label>
            <input value={landingPageUrl} onChange={e => setLandingPageUrl(e.target.value)} placeholder="https://..." />
          </div>

          {error && <div className="form-msg error">{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Salvando...' : 'Cadastrar anúncio'}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>
            Se esse mesmo concorrente + headline + landing page já existir, isso vira
            um novo snapshot (histórico de mudança), não duplica o registro.
          </p>
        </form>
      </div>
    </div>
  );
}
