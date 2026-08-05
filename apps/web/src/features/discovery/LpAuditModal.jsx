import { useState } from 'react';
import { api } from '../../api/client';

export default function LpAuditModal({ product, onClose, onSaved }) {
  const [hasCta, setHasCta] = useState(product.has_cta ?? null);
  const [hasVsl, setHasVsl] = useState(product.has_vsl ?? null);
  const [affiliateParamsPreserved, setAffiliateParamsPreserved] = useState(product.affiliate_params_preserved ?? null);
  const [salesPageUrl, setSalesPageUrl] = useState(product.sales_page_url || '');
  const [lpNotes, setLpNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/products/manual', {
        networkType: product.network_type,
        externalId: product.external_id,
        name: product.name,
        category: product.category,
        price: product.price != null ? Number(product.price) : null,
        commissionType: product.commission_type,
        commissionValue: Number(product.commission_value),
        conversionRate: product.conversion_rate != null ? Number(product.conversion_rate) : 0,
        currency: product.currency,
        salesPageUrl: salesPageUrl.trim() || null,
        skipCompliance: true,
        hasCta,
        hasVsl,
        affiliateParamsPreserved,
        lpNotes: lpNotes.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function ThreeWayToggle({ label, value, onChange }) {
    return (
      <div className="field">
        <label>{label}</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['Sim', true], ['Não', false], ['?', null]].map(([text, val]) => (
            <button
              key={text}
              type="button"
              className="btn"
              onClick={() => onChange(val)}
              style={{
                flex: 1, padding: '7px 0', fontSize: '0.78rem',
                borderColor: value === val ? 'var(--green)' : undefined,
                color: value === val ? 'var(--green)' : undefined,
              }}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Auditoria da página — {product.name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: -8, marginBottom: 16 }}>
          Preencha depois de abrir a página de vendas de verdade (e, se possível, testar
          o link promocional até o checkout).
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field field-full">
            <label>URL da página de vendas</label>
            <input value={salesPageUrl} onChange={e => setSalesPageUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div className="form-grid">
            <ThreeWayToggle label="Tem CTA claro?" value={hasCta} onChange={setHasCta} />
            <ThreeWayToggle label="Tem VSL (vídeo)?" value={hasVsl} onChange={setHasVsl} />
          </div>
          <div style={{ marginTop: 12 }}>
            <ThreeWayToggle label="Parâmetro de afiliado preservado até o checkout?" value={affiliateParamsPreserved} onChange={setAffiliateParamsPreserved} />
          </div>

          <div className="field field-full" style={{ marginTop: 12 }}>
            <label>Notas (opcional)</label>
            <textarea rows={3} value={lpNotes} onChange={e => setLpNotes(e.target.value)}
              placeholder="Ex: testado em navegador anônimo, parâmetro confirmado até o checkout..."
              style={{ width: '100%', background: 'var(--panel-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', color: 'var(--text)', fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', resize: 'vertical' }} />
          </div>

          {error && <div className="form-msg error">{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Salvando...' : 'Salvar auditoria'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
