const HEALTH_LABELS = { green: 'Saudável', yellow: 'Atenção', red: 'Crítico' };

export default function AccountDetailModal({ account, onClose }) {
  if (!account) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{account.name || account.customer_id}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span className={`health-dot ${account.health}`} />
          <span style={{ fontWeight: 600 }}>{HEALTH_LABELS[account.health] || account.health}</span>
          <span className="badge" style={{ marginLeft: 'auto' }}>{account.status}</span>
        </div>

        <div className="form-grid">
          <div className="field"><label>customer_id</label><div>{account.customer_id}</div></div>
          <div className="field"><label>MCC</label><div>{account.mcc_name || '—'}</div></div>
          <div className="field"><label>Operação</label><div>{account.operacao || '—'}</div></div>
          <div className="field"><label>Marca</label><div>{account.marca || '—'}</div></div>
          <div className="field"><label>Região</label><div>{account.regiao || '—'}</div></div>
          <div className="field"><label>Domínio</label><div>{account.dominio || '—'}</div></div>
          <div className="field"><label>Método de pagamento</label><div>{account.payment_method_label || '—'}</div></div>
          <div className="field"><label>Teto de orçamento/dia</label><div>{account.daily_budget_cap || '—'}</div></div>
          <div className="field field-full"><label>Alertas abertos</label><div>{account.open_alerts_count || 0}</div></div>
        </div>

        {account.health === 'red' && (
          <div className="form-msg error" style={{ marginTop: 10 }}>
            Status preocupante ({account.status}). Ver docs/PLANO_CONTINGENCIA.md pro procedimento.
          </div>
        )}
        {account.health === 'yellow' && (
          <div className="form-msg" style={{ marginTop: 10, color: 'var(--amber)' }}>
            Tem alerta aberto vinculado a essa conta — confira a aba Alertas.
          </div>
        )}
      </div>
    </div>
  );
}
