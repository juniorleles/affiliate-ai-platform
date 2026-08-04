import { Fragment, useEffect, useState } from 'react';
import { api } from '../../api/client';

const VERDICT_LABELS = {
  increase_budget: 'Aumentar orçamento',
  maintain: 'Manter',
  decrease_budget: 'Reduzir orçamento',
  pause: 'Pausar',
};
const CONFIDENCE_LABELS = { high: 'alta', medium: 'média', low: 'baixa' };

function fmtMoney(v) { return 'R$ ' + Number(v || 0).toFixed(2); }
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [error, setError] = useState('');

  async function loadCampaigns() {
    setLoading(true);
    try {
      const data = await api.get('/campaigns');
      setCampaigns(data.campaigns);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCampaigns(); }, []);

  async function handleSync() {
    setSyncing(true);
    setError('');
    try {
      await api.post('/campaigns/sync');
      await loadCampaigns();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleAnalyze(id) {
    setAnalyzingId(id);
    setError('');
    try {
      await api.post(`/campaigns/${id}/analyze`);
      await loadCampaigns();
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzingId(null);
    }
  }

  async function handleTargetChange(id, field, value) {
    const body = { [field]: value === '' ? null : Number(value) };
    await api.patch(`/campaigns/${id}`, body);
  }

  return (
    <>
      <div className="panel" style={{ marginBottom: 20 }}>
        <h2>Como ler o veredito da IA</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.6, margin: 0 }}>
          Cada campanha recebe uma recomendação com base no CPA, ROAS (priorizando a receita real
          dos afiliados) e na tendência dos últimos 30 dias.{' '}
          <b style={{ color: 'var(--green)' }}>Aumentar orçamento</b> ·{' '}
          <b style={{ color: 'var(--text-muted)' }}>Manter</b> ·{' '}
          <b style={{ color: 'var(--amber)' }}>Reduzir orçamento</b> ·{' '}
          <b style={{ color: 'var(--red)' }}>Pausar</b>. É recomendação de apoio, a decisão final é sua.
        </p>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>Campanhas</h2>
          <button className="btn" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Sincronizando...' : 'Sincronizar com Google Ads'}
          </button>
        </div>

        {error && <div className="form-msg error" style={{ marginBottom: 10 }}>{error}</div>}

        {loading ? (
          <div className="empty-state">Carregando...</div>
        ) : campaigns.length === 0 ? (
          <div className="empty-state">Nenhuma campanha sincronizada ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Campanha</th><th>Status</th><th>Gasto (30d)</th><th>Conv. Google</th>
                <th>Conv. afiliados</th><th>Receita afiliados</th><th>Meta CPA / ROAS</th>
                <th>Veredito IA</th><th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const a = c.latest_analysis;
                const isExpanded = expandedId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr className="row-clickable" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                      <td className="name-cell">{c.name}</td>
                      <td><span className={`badge ${c.status === 'ENABLED' ? 'active' : c.status === 'PAUSED' ? 'paused' : 'blocked'}`}>{c.status || '—'}</span></td>
                      <td>{fmtMoney(c.cost_30d)}</td>
                      <td>{Math.round(c.google_conversions_30d)}</td>
                      <td>{c.affiliate_conversions_30d}</td>
                      <td>{fmtMoney(c.affiliate_revenue_30d)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <input className="mini-input" type="number" step="0.01" placeholder="CPA"
                          defaultValue={c.target_cpa ?? ''}
                          onBlur={e => handleTargetChange(c.id, 'target_cpa', e.target.value)} />
                        <input className="mini-input" type="number" step="0.01" placeholder="ROAS"
                          defaultValue={c.target_roas ?? ''}
                          onBlur={e => handleTargetChange(c.id, 'target_roas', e.target.value)} />
                      </td>
                      <td>
                        {a
                          ? <span className={`verdict ${a.verdict}`}><span className={`confidence-dot ${a.confidence}`} />{VERDICT_LABELS[a.verdict] || a.verdict}</span>
                          : <span className="verdict none">Sem análise</span>}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn" style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                          onClick={() => handleAnalyze(c.id)} disabled={analyzingId === c.id}>
                          {analyzingId === c.id ? 'Analisando...' : 'Analisar agora'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="reasoning-row">
                        <td colSpan={9}>
                          {a ? (
                            <>
                              <b style={{ color: 'var(--text)' }}>Análise de {fmtDate(a.created_at)}</b>
                              {' '}(confiança {CONFIDENCE_LABELS[a.confidence] || a.confidence}
                              {a.cpa != null && ` · CPA ${fmtMoney(a.cpa)}`}
                              {a.roas != null && ` · ROAS ${Number(a.roas).toFixed(2)}x`})
                              <br /><br />{a.reasoning}
                            </>
                          ) : 'Nenhuma análise gerada ainda para esta campanha. Clique em "Analisar agora".'}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
