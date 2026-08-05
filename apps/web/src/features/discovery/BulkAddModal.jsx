import { useState } from 'react';
import { api } from '../../api/client';

const CURRENCIES = ['EUR', 'BRL', 'USD', 'GBP'];

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function emptyRow() {
  return {
    name: '', externalId: '', externalIdTouched: false, networkType: '',
    commissionValue: '', price: '', conversionRatePct: '', currency: 'EUR',
  };
}

export default function BulkAddModal({ onClose, onSaved }) {
  const [rows, setRows] = useState([emptyRow(), emptyRow(), emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function updateRow(index, field, value) {
    setRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      if (field === 'name' && !row.externalIdTouched) {
        updated.externalId = slugify(value);
      }
      if (field === 'externalId') updated.externalIdTouched = true;
      return updated;
    }));
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow()]);
  }

  function removeRow(index) {
    setRows(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const validRows = rows.filter(r => r.name.trim() && r.networkType.trim() && r.commissionValue);
    if (validRows.length === 0) {
      setError('Preencha ao menos nome, rede e comissão em pelo menos 1 linha.');
      return;
    }

    setSaving(true);
    try {
      const products = validRows.map(r => ({
        networkType: r.networkType.trim(),
        externalId: (r.externalId || slugify(r.name)).trim(),
        name: r.name.trim(),
        commissionType: 'flat',
        commissionValue: Number(r.commissionValue),
        price: r.price ? Number(r.price) : null,
        conversionRate: r.conversionRatePct ? Number(r.conversionRatePct) / 100 : 0,
        currency: r.currency,
      }));

      const data = await api.post('/products/manual/bulk', { products });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const ECONOMICS_LABELS = {
    viavel: 'Viável', rejeitado_por_economics: 'Rejeitado (leilão)',
    rejeitado_por_comissao_minima: 'Comissão baixa', dado_insuficiente: 'Dado insuficiente',
    erro_avaliacao: 'Erro', erro_avaliacao_falhou: 'Falhou',
  };

  if (result) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Resultado do cadastro em lote</h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {result.sucesso} de {result.total} cadastrados com sucesso
            {result.falha > 0 ? `, ${result.falha} com erro` : ''}.
          </p>
          <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.results.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--panel-raised)', borderRadius: 8, fontSize: '0.82rem' }}>
                <span>{r.name}</span>
                {r.ok ? (
                  <span className={`verdict ${r.economics?.status || ''}`}>
                    {ECONOMICS_LABELS[r.economics?.status] || 'Cadastrado'}
                  </span>
                ) : (
                  <span style={{ color: 'var(--red)', fontSize: '0.78rem' }}>{r.error}</span>
                )}
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} onClick={() => { onSaved(); }}>
            Fechar e atualizar lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <h2>Cadastro em lote</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: -8, marginBottom: 14 }}>
          Preencha o quanto quiser de linhas. Linhas em branco são ignoradas. A auditoria
          de LP e a classificação de compliance ficam pra depois, pelo card de cada produto.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th><th>Rede</th><th>Comissão</th><th>Moeda</th><th>Preço</th><th>Conv. %</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td><input className="mini-input" style={{ width: 140 }} value={row.name} onChange={e => updateRow(i, 'name', e.target.value)} /></td>
                    <td><input className="mini-input" style={{ width: 90 }} value={row.networkType} onChange={e => updateRow(i, 'networkType', e.target.value)} placeholder="digistore24" /></td>
                    <td><input className="mini-input" style={{ width: 70 }} type="number" step="0.01" value={row.commissionValue} onChange={e => updateRow(i, 'commissionValue', e.target.value)} /></td>
                    <td>
                      <select className="mini-input" value={row.currency} onChange={e => updateRow(i, 'currency', e.target.value)}>
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td><input className="mini-input" style={{ width: 70 }} type="number" step="0.01" value={row.price} onChange={e => updateRow(i, 'price', e.target.value)} /></td>
                    <td><input className="mini-input" style={{ width: 55 }} type="number" step="0.1" value={row.conversionRatePct} onChange={e => updateRow(i, 'conversionRatePct', e.target.value)} /></td>
                    <td>
                      <button type="button" className="modal-close" onClick={() => removeRow(i)} title="Remover linha">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="collapsible-toggle" onClick={addRow}>+ Adicionar linha</button>

          {error && <div className="form-msg error">{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Salvando...' : 'Cadastrar todos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
