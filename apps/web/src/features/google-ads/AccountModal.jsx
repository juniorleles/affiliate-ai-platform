import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function AccountModal({ onClose, onSaved }) {
  const [mccs, setMccs] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [name, setName] = useState('');
  const [mccId, setMccId] = useState('');
  const [operacao, setOperacao] = useState('');
  const [marca, setMarca] = useState('');
  const [regiao, setRegiao] = useState('');
  const [dominio, setDominio] = useState('');
  const [paymentMethodLabel, setPaymentMethodLabel] = useState('');
  const [dailyBudgetCap, setDailyBudgetCap] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/campaigns/mccs').then(data => setMccs(data.mccs)).catch(() => setMccs([]));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!customerId.trim()) {
      setError('customer_id é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/campaigns/accounts', {
        customerId: customerId.trim(),
        name: name.trim() || undefined,
        mccId: mccId || undefined,
        operacao: operacao.trim() || undefined,
        marca: marca.trim() || undefined,
        regiao: regiao.trim() || undefined,
        dominio: dominio.trim() || undefined,
        paymentMethodLabel: paymentMethodLabel.trim() || undefined,
        dailyBudgetCap: dailyBudgetCap ? Number(dailyBudgetCap) : undefined,
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
          <h2>Nova conta do Google Ads</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>customer_id *</label>
              <input value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="123-456-7890" />
            </div>
            <div className="field">
              <label>Nome</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Conta 1" />
            </div>
          </div>

          <div className="field field-full">
            <label>MCC</label>
            <select value={mccId} onChange={e => setMccId(e.target.value)}>
              <option value="">Nenhuma / não sei ainda</option>
              {mccs.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Operação</label>
              <input value={operacao} onChange={e => setOperacao(e.target.value)} placeholder="Agência A / Interna" />
            </div>
            <div className="field">
              <label>Marca</label>
              <input value={marca} onChange={e => setMarca(e.target.value)} placeholder="Nome da marca" />
            </div>
            <div className="field">
              <label>Região</label>
              <input value={regiao} onChange={e => setRegiao(e.target.value)} placeholder="Brasil" />
            </div>
            <div className="field">
              <label>Domínio</label>
              <input value={dominio} onChange={e => setDominio(e.target.value)} placeholder="exemplo.com" />
            </div>
            <div className="field">
              <label>Rótulo do método de pagamento</label>
              <input value={paymentMethodLabel} onChange={e => setPaymentMethodLabel(e.target.value)} placeholder="Cartão A" />
            </div>
            <div className="field">
              <label>Teto de orçamento diário</label>
              <input type="number" step="0.01" value={dailyBudgetCap} onChange={e => setDailyBudgetCap(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          {error && <div className="form-msg error">{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Salvando...' : 'Cadastrar conta'}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>
            O rótulo de método de pagamento é só descritivo — não integra com dado real de
            cobrança, serve pra você enxergar quantas contas dependem do mesmo cartão.
          </p>
        </form>
      </div>
    </div>
  );
}
