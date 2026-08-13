import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import McCModal from './McCModal';
import AccountModal from './AccountModal';
import AccountTree from './AccountTree';
import AccountHeatmap from './AccountHeatmap';
import AccountDetailModal from './AccountDetailModal';

function statusClass(status) {
  if (status === 'active' || status === 'ENABLED') return 'active';
  if (status === 'SUSPENDED' || status === 'CANCELED' || status === 'CLOSED') return 'blocked';
  return 'paused';
}

const VIEWS = [
  { id: 'tree', label: 'Árvore' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'table', label: 'Tabela' },
];

export default function AccountsPage() {
  const [rollup, setRollup] = useState(null);
  const [mccs, setMccs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [showMccModal, setShowMccModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [view, setView] = useState('tree');
  const [selectedAccount, setSelectedAccount] = useState(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [rollupData, mccsData] = await Promise.all([
        api.get('/campaigns/governance/rollup'),
        api.get('/campaigns/mccs'),
      ]);
      setRollup(rollupData);
      setMccs(mccsData.mccs);
    } catch (err) {
      setRollup({ accounts: [], totalAccounts: 0, byPaymentMethod: {}, byOperacao: {}, byStatus: {}, byHealth: { green: 0, yellow: 0, red: 0 } });
      setMccs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function refreshStatuses() {
    await api.post('/campaigns/accounts/refresh-status', {});
    loadAll();
  }

  async function deleteAccount(account) {
    const label = account.name || account.customer_id;
    if (!window.confirm(`Excluir "${label}" (${account.customer_id})? Isso não pode ser desfeito.`)) return;
    await api.delete(`/campaigns/accounts/${account.id}`);
    loadAll();
  }

  async function syncFromGoogle() {
    if (mccs.length === 0) {
      setSyncMessage('Cadastre uma MCC primeiro (botão "+ Nova MCC").');
      return;
    }
    // Com só 1 MCC, sincroniza direto. Com mais de 1, pede pra escolher —
    // simples de propósito, dado o volume esperado (dezenas de contas, poucas MCCs).
    const mcc = mccs.length === 1 ? mccs[0] : mccs.find(m => m.name === window.prompt(`Qual MCC? (${mccs.map(m => m.name).join(', ')})`));
    if (!mcc) return;

    setSyncing(true);
    setSyncMessage('');
    try {
      const result = await api.post(`/campaigns/mccs/${mcc.id}/sync-accounts`, {});
      setSyncMessage(`${mcc.name}: ${result.totalDiscovered} conta(s) encontrada(s) no Google — ${result.created} nova(s), ${result.updated} atualizada(s), ${result.skippedManagers} sub-MCC(s) ignorada(s).`);
      loadAll();
    } catch (err) {
      setSyncMessage(`Erro: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  if (loading || !rollup) return <div className="empty-state">Carregando...</div>;

  const paymentEntries = Object.entries(rollup.byPaymentMethod);
  const riskyPayment = paymentEntries.filter(([, count]) => count >= 5);
  const health = rollup.byHealth || { green: 0, yellow: 0, red: 0 };

  return (
    <>
      <div className="products-toolbar">
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.05rem' }}>Contas e Governança</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Estrutura guarda-chuva legítima — visibilidade e isolamento de risco entre contas,
            nunca criação de conta pra burlar suspensão.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setShowMccModal(true)}>+ Nova MCC</button>
          <button className="btn" onClick={syncFromGoogle} disabled={syncing}>
            {syncing ? 'Sincronizando...' : 'Sincronizar contas da MCC'}
          </button>
          <button className="btn" onClick={refreshStatuses}>Atualizar status</button>
          <button className="btn btn-primary" onClick={() => setShowAccountModal(true)}>+ Nova conta</button>
        </div>
      </div>

      {syncMessage && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="empty-state">{syncMessage}</div>
        </div>
      )}

      <div className="kpi-strip">
        <div className="kpi"><div className="kpi-label">Total de contas</div><div className="kpi-value">{rollup.totalAccounts}</div></div>
        <div className="kpi">
          <div className="kpi-label">🟢 Saudáveis</div>
          <div className="kpi-value green">{health.green}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">🟡 Atenção</div>
          <div className="kpi-value amber">{health.yellow}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">🔴 Críticas</div>
          <div className={`kpi-value ${health.red > 0 ? 'amber' : ''}`} style={health.red > 0 ? { color: 'var(--red)' } : {}}>{health.red}</div>
        </div>
      </div>

      {riskyPayment.length > 0 && (
        <div className="panel" style={{ borderColor: 'var(--amber)', marginBottom: 16 }}>
          <div className="empty-state" style={{ color: 'var(--amber)' }}>
            ⚠️ {riskyPayment.map(([label, count]) => `"${label}" tem ${count} contas dependendo dele`).join('; ')} —
            se esse método de pagamento falhar, todas essas contas param juntas.
          </div>
        </div>
      )}

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>Contas</h2>
          <div className="view-toggle">
            {VIEWS.map(v => (
              <button key={v.id} className={view === v.id ? 'active' : ''} onClick={() => setView(v.id)}>{v.label}</button>
            ))}
          </div>
        </div>

        {rollup.accounts.length === 0 ? (
          <div className="empty-state">Nenhuma conta cadastrada ainda.</div>
        ) : view === 'tree' ? (
          <AccountTree accounts={rollup.accounts} onSelectAccount={setSelectedAccount} />
        ) : view === 'heatmap' ? (
          <AccountHeatmap accounts={rollup.accounts} onSelectAccount={setSelectedAccount} />
        ) : (
          <table>
            <thead>
              <tr><th></th><th>Conta</th><th>MCC</th><th>Operação</th><th>Região</th><th>Pagamento</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rollup.accounts.map(a => (
                <tr key={a.id} style={{ cursor: 'pointer' }}>
                  <td onClick={() => setSelectedAccount(a)}><span className={`health-dot ${a.health}`} /></td>
                  <td className="name-cell" onClick={() => setSelectedAccount(a)}>{a.name || a.customer_id}<br /><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{a.customer_id}</span></td>
                  <td onClick={() => setSelectedAccount(a)}>{a.mcc_name || '—'}</td>
                  <td onClick={() => setSelectedAccount(a)}>{a.operacao || '—'}</td>
                  <td onClick={() => setSelectedAccount(a)}>{a.regiao || '—'}</td>
                  <td onClick={() => setSelectedAccount(a)}>{a.payment_method_label || '—'}</td>
                  <td onClick={() => setSelectedAccount(a)}><span className={`badge ${statusClass(a.status)}`}>{a.status}</span></td>
                  <td>
                    <button
                      className="btn"
                      style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                      onClick={(e) => { e.stopPropagation(); deleteAccount(a); }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showMccModal && <McCModal onClose={() => setShowMccModal(false)} onSaved={() => { setShowMccModal(false); loadAll(); }} />}
      {showAccountModal && <AccountModal onClose={() => setShowAccountModal(false)} onSaved={() => { setShowAccountModal(false); loadAll(); }} />}
      {selectedAccount && <AccountDetailModal account={selectedAccount} onClose={() => setSelectedAccount(null)} />}
    </>
  );
}
