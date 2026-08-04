import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const SEVERITY_COLOR = { low: 'var(--text-muted)', medium: 'var(--amber)', high: 'var(--red)', critical: 'var(--red)' };

function fmtDate(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  async function loadAlerts() {
    setLoading(true);
    const data = await api.get('/monitoring/alerts');
    setAlerts(data.alerts);
    setLoading(false);
  }

  useEffect(() => { loadAlerts(); }, []);

  async function handleCheckNow() {
    setChecking(true);
    try {
      await api.post('/monitoring/internal/check');
      await loadAlerts();
    } finally {
      setChecking(false);
    }
  }

  async function updateStatus(id, status) {
    await api.patch(`/monitoring/alerts/${id}`, { status });
    loadAlerts();
  }

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Alertas</h2>
        <button className="btn" onClick={handleCheckNow} disabled={checking}>
          {checking ? 'Checando...' : 'Checar agora'}
        </button>
      </div>

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : alerts.length === 0 ? (
        <div className="empty-state">Nenhum alerta registrado. Tudo certo por aqui.</div>
      ) : (
        <table>
          <thead><tr><th>Tipo</th><th>Severidade</th><th>Mensagem</th><th>Status</th><th>Quando</th><th></th></tr></thead>
          <tbody>
            {alerts.map(a => (
              <tr key={a.id}>
                <td className="name-cell">{a.type}</td>
                <td><span style={{ color: SEVERITY_COLOR[a.severity] || 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>{a.severity}</span></td>
                <td className="name-cell">{a.message}</td>
                <td><span className={`badge ${a.status}`}>{a.status}</span></td>
                <td>{fmtDate(a.created_at)}</td>
                <td>
                  {a.status !== 'resolved' && (
                    <select defaultValue="" onChange={e => updateStatus(a.id, e.target.value)}
                      style={{ background: 'var(--panel-raised)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.75rem', padding: '3px 5px' }}>
                      <option value="">Ação...</option>
                      <option value="ack">Reconhecer</option>
                      <option value="resolved">Resolver</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
