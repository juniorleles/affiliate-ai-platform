import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const NETWORK_SUGGESTIONS = ['digistore24', 'clickbank', 'cj', 'impact', 'awin', 'partnerstack'];
const CURRENCIES = ['EUR', 'BRL', 'USD', 'GBP'];

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function QuickAddModal({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [externalId, setExternalId] = useState('');
  const [externalIdTouched, setExternalIdTouched] = useState(false);
  const [networkType, setNetworkType] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [commissionValue, setCommissionValue] = useState('');
  const [conversionRatePct, setConversionRatePct] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [description, setDescription] = useState('');
  const [salesPageUrl, setSalesPageUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minCommission, setMinCommission] = useState('');

  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!externalIdTouched) setExternalId(slugify(name));
  }, [name, externalIdTouched]);

  useEffect(() => {
    const commissao = Number(commissionValue);
    const conversao = Number(conversionRatePct);
    if (!commissao || isNaN(commissao) || !conversao || isNaN(conversao)) {
      setPreview(null);
      setPreviewError('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const body = {
          comissaoEsperada: commissao,
          taxaConversaoEsperada: conversao / 100,
        };
        if (minCommission) body.comissaoMinima = Number(minCommission);
        const { result } = await api.post('/market-intel/economics/evaluate', body);
        setPreview(result);
        setPreviewError('');
      } catch (err) {
        setPreview(null);
        setPreviewError(err.message);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [commissionValue, conversionRatePct, minCommission]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaveError('');

    if (!name.trim() || !networkType.trim() || !externalId.trim() || !commissionValue) {
      setSaveError('Nome, rede, identificador e comissão são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/products/manual', {
        networkType: networkType.trim(),
        externalId: externalId.trim(),
        name: name.trim(),
        category: category.trim() || null,
        description: description.trim() || null,
        price: price ? Number(price) : null,
        commissionType: 'flat',
        commissionValue: Number(commissionValue),
        conversionRate: conversionRatePct ? Number(conversionRatePct) / 100 : 0,
        currency,
        salesPageUrl: salesPageUrl.trim() || null,
        minCommission: minCommission ? Number(minCommission) : undefined,
      });
      onSaved();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Adicionar produto</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field field-full">
              <label>Nome do produto *</label>
              <input value={name} onChange={e => setName(e.target.value)} autoFocus />
            </div>

            <div className="field">
              <label>Rede *</label>
              <input list="network-suggestions" value={networkType} onChange={e => setNetworkType(e.target.value)} placeholder="digistore24" />
              <datalist id="network-suggestions">
                {NETWORK_SUGGESTIONS.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>

            <div className="field">
              <label>Identificador (auto)</label>
              <input
                value={externalId}
                onChange={e => { setExternalId(e.target.value); setExternalIdTouched(true); }}
              />
            </div>

            <div className="field">
              <label>Comissão por venda *</label>
              <input type="number" step="0.01" value={commissionValue} onChange={e => setCommissionValue(e.target.value)} placeholder="60.05" />
            </div>

            <div className="field">
              <label>Moeda</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Preço do produto</label>
              <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="106.44" />
            </div>

            <div className="field">
              <label>Taxa de conversão esperada (%)</label>
              <input type="number" step="0.1" value={conversionRatePct} onChange={e => setConversionRatePct(e.target.value)} placeholder="7" />
            </div>
          </div>

          {(preview || previewError) && (
            <div className={`economics-preview ${preview?.status || ''}`}>
              {preview ? (
                <>
                  <div>
                    <div className="ep-label">CPC máximo calculado</div>
                    <div className="ep-value">{preview.cpcMaximoCalculado != null ? `${currency} ${preview.cpcMaximoCalculado}` : '—'}</div>
                  </div>
                  <span className={`verdict ${preview.status}`}>
                    {{
                      viavel: 'Viável',
                      rejeitado_por_economics: 'Rejeitado (leilão)',
                      rejeitado_por_comissao_minima: 'Comissão baixa demais',
                      dado_insuficiente: 'Dado insuficiente',
                    }[preview.status] || preview.status}
                  </span>
                </>
              ) : (
                <span style={{ color: 'var(--red)', fontSize: '0.8rem' }}>{previewError}</span>
              )}
            </div>
          )}

          <div className="field field-full">
            <label>Categoria</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Suplementos alimentares - Saúde" />
          </div>

          <div className="field field-full">
            <label>Descrição (usada pela IA pra classificar compliance)</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
              style={{ width: '100%', background: 'var(--panel-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', color: 'var(--text)', fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', resize: 'vertical' }} />
          </div>

          <button type="button" className="collapsible-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? '− Ocultar opções avançadas' : '+ Opções avançadas (URL da página, comissão mínima)'}
          </button>

          {showAdvanced && (
            <div className="form-grid" style={{ marginTop: 8 }}>
              <div className="field field-full">
                <label>URL da página de vendas</label>
                <input value={salesPageUrl} onChange={e => setSalesPageUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="field">
                <label>Comissão mínima (trava)</label>
                <input type="number" step="0.01" value={minCommission} onChange={e => setMinCommission(e.target.value)} placeholder="20 (padrão)" />
              </div>
            </div>
          )}

          {saveError && <div className="form-msg error">{saveError}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Salvando...' : 'Cadastrar produto'}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>
            Depois de salvar, a IA já classifica a sensibilidade de nicho automaticamente.
            A auditoria da página de vendas (CTA/VSL/parâmetro de afiliado) fica pra quando você abrir a página de verdade — não precisa fazer agora.
          </p>
        </form>
      </div>
    </div>
  );
}
