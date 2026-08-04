import { useEffect, useState } from 'react';
import { api } from '../../api/client';

function fmtMoney(v) { return 'R$ ' + Number(v || 0).toFixed(2); }
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    const [summaryData, affiliatesData] = await Promise.all([
      api.get('/dashboard/summary'),
      api.get('/affiliates'),
    ]);
    setSummary(summaryData);
    setAffiliates(affiliatesData.affiliates);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function updateStatus(id, status) {
    if (!status) return;
    await api.patch(`/affiliates/${id}`, { status });
    loadAll();
  }

  if (loading || !summary) return <div className="empty-state">Carregando...</div>;

  const t = summary.totals;

  return (
    <>
      <div className="kpi-strip">
        <div className="kpi"><div className="kpi-label">Afiliados ativos</div><div className="kpi-value">{t.active_affiliates}/{t.total_affiliates}</div></div>
        <div className="kpi"><div className="kpi-label">Cliques</div><div className="kpi-value">{t.total_clicks}</div></div>
        <div className="kpi"><div className="kpi-label">Conversões</div><div className="kpi-value green">{t.total_conversions}</div></div>
        <div className="kpi"><div className="kpi-label">Taxa de conversão</div><div className="kpi-value">{t.conversion_rate}%</div></div>
        <div className="kpi"><div className="kpi-label">Comissão pendente</div><div className="kpi-value amber">{fmtMoney(t.pending_commission)}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 20 }}>
        <div className="panel">
          <h2>Afiliados</h2>
          {affiliates.length === 0 ? (
            <div className="empty-state">Nenhum afiliado cadastrado ainda.</div>
          ) : (
            <table>
              <thead><tr><th>Nome</th><th>Cliques</th><th>Conv.</th><th>Comissão</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {affiliates.map(a => (
                  <tr key={a.id}>
                    <td className="name-cell">{a.name}<br /><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{a.email}</span></td>
                    <td>{a.total_clicks}</td>
                    <td>{a.total_conversions}</td>
                    <td>{fmtMoney(a.total_commission)}</td>
                    <td><span className={`badge ${a.status}`}>{a.status}</span></td>
                    <td>
                      <select defaultValue="" onChange={e => updateStatus(a.id, e.target.value)}
                        style={{ background: 'var(--panel-raised)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.75rem', padding: '3px 5px' }}>
                        <option value="">Ação...</option>
                        <option value="active">Ativar</option>
                        <option value="paused">Pausar</option>
                        <option value="blocked">Bloquear</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h2>Atividade recente</h2>
          {summary.recentActivity.length === 0 ? (
            <div className="empty-state">Sem atividade registrada ainda.</div>
          ) : (
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', maxHeight: 480, overflowY: 'auto' }}>
              {summary.recentActivity.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                  <span style={{ color: '#4B5A80', flexShrink: 0 }}>{fmtDate(item.ts)}</span>
                  <span style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: '0.68rem', width: 78, flexShrink: 0, color: item.type === 'conversion' ? 'var(--green)' : 'var(--text-muted)' }}>
                    {item.type === 'click' ? 'clique' : 'conversão'}
                  </span>
                  <span>{item.affiliate_name}{item.detail ? ' · ' + item.detail : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
