import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const SATURATION_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const CHANCE_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };

function ScoreBar({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 3 }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{value != null ? value : '—'}</span>
      </div>
      <div style={{ height: 6, background: 'var(--panel-raised)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${value != null ? value : 0}%`,
          background: value == null ? 'transparent' : value >= 70 ? 'var(--green)' : value >= 40 ? 'var(--amber)' : 'var(--red)',
        }} />
      </div>
    </div>
  );
}

export default function MarketIntelDetail({ product, onClose }) {
  const [score, setScore] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  async function loadExisting() {
    setLoading(true);
    try {
      const scoreData = await api.get(`/market-intel/${product.id}/score`);
      setScore(scoreData.score);

      const analysesData = await api.get(`/ai-advisor/analyses?subject_type=product&subject_id=${product.id}`);
      const latest = (analysesData.analyses || []).find(a => a.question_type === 'product_opportunity');
      setAnalysis(latest || null);
    } catch (err) {
      // sem análise ainda — normal
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadExisting(); }, [product.id]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError('');
    try {
      await api.post(`/market-intel/${product.id}/analyze`);
      await loadExisting();
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  const result = analysis?.response;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h2>{product.name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="empty-state">Carregando...</div>
        ) : (
          <>
            {score && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Score determinístico</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.4rem', fontWeight: 700 }}>{score.score ?? '—'}</span>
                </div>
                <ScoreBar label="Demanda" value={score.demand_score} />
                <ScoreBar label="Competição" value={score.competition_score} />
                <ScoreBar label="Qualidade da LP" value={score.sales_page_quality_score} />
              </div>
            )}

            {result ? (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span className={`verdict ${result.worth_advertising ? 'worth-yes' : 'worth-no'}`}>
                    {result.worth_advertising ? 'Vale anunciar' : 'Não vale anunciar'}
                  </span>
                  <span className={`verdict ${result.confidence}`}>Confiança: {CHANCE_LABELS[result.confidence] || result.confidence}</span>
                  <span className="badge">Saturação: {SATURATION_LABELS[result.market_saturation] || result.market_saturation}</span>
                  <span className="badge">Chance de lucro: {CHANCE_LABELS[result.estimated_profit_chance] || result.estimated_profit_chance}</span>
                </div>

                <div className="form-grid" style={{ marginBottom: 14 }}>
                  <div className="field">
                    <label>CPC máximo recomendado</label>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>{result.max_recommended_cpc ?? '—'}</div>
                  </div>
                  <div className="field">
                    <label>CPA máximo recomendado</label>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>{result.max_recommended_cpa ?? '—'}</div>
                  </div>
                  <div className="field field-full">
                    <label>Orçamento inicial sugerido</label>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>{result.suggested_initial_budget ?? '—'}</div>
                  </div>
                </div>

                {result.main_risks?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', marginBottom: 6 }}>Principais riscos</label>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {result.main_risks.map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
                    </ul>
                  </div>
                )}

                {result.roi_improvement_suggestions?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', marginBottom: 6 }}>Sugestões pra melhorar o ROI</label>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {result.roi_improvement_suggestions.map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
                    </ul>
                  </div>
                )}

                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <b style={{ color: 'var(--text)' }}>Raciocínio:</b> {result.reasoning}
                </p>
              </div>
            ) : (
              <div className="empty-state">Nenhuma análise ainda. Clique em "Analisar" abaixo.</div>
            )}

            {error && <div className="form-msg error">{error}</div>}

            <button className="btn btn-primary" onClick={handleAnalyze} disabled={analyzing} style={{ width: '100%', marginTop: 12 }}>
              {analyzing ? 'Analisando (a IA está lendo tudo)...' : result ? 'Reanalisar' : 'Analisar oportunidade'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
