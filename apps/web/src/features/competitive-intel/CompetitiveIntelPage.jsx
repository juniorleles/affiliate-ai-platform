import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import CompetitorAdModal from './CompetitorAdModal';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function CompetitiveIntelPage() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function loadAds() {
    setLoading(true);
    try {
      const data = await api.get('/competitive-intel');
      setAds(data.ads);
    } catch (err) {
      setAds([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAds(); }, []);

  return (
    <>
      <div className="products-toolbar">
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.05rem' }}>Inteligência Competitiva</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Cadastro manual, a partir do <a href="https://adstransparency.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--green)' }}>Google Ads Transparency Center</a> (oficial, gratuito, sem API pública).
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Adicionar anúncio</button>
      </div>

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : ads.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            Nenhum anúncio de concorrente cadastrado ainda. Busque um concorrente no
            Transparency Center e clique em "+ Adicionar anúncio".
          </div>
        </div>
      ) : (
        <div className="panel">
          <table>
            <thead>
              <tr><th>Concorrente</th><th>Headline</th><th>Visto pela 1ª vez</th><th>Última vez visto</th><th>Snapshots</th></tr>
            </thead>
            <tbody>
              {ads.map(ad => (
                <tr key={ad.id}>
                  <td className="name-cell">{ad.competitor_name}{ad.competitor_domain ? <><br /><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{ad.competitor_domain}</span></> : null}</td>
                  <td className="name-cell">{ad.headline}</td>
                  <td>{fmtDate(ad.first_seen_at)}</td>
                  <td>{fmtDate(ad.last_seen_at)}</td>
                  <td>{ad.snapshot_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <CompetitorAdModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadAds(); }}
        />
      )}
    </>
  );
}
