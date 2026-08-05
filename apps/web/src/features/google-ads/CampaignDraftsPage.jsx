import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import CampaignDraftModal from './CampaignDraftModal';
import CampaignDraftDetail from './CampaignDraftDetail';

const STATUS_LABELS = {
  draft: 'Rascunho', approved: 'Aprovado', created_in_google_ads: 'Criado no Google Ads',
};

export default function CampaignDraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [openDraftId, setOpenDraftId] = useState(null);

  async function loadDrafts() {
    setLoading(true);
    try {
      const data = await api.get('/campaigns/drafts');
      setDrafts(data.drafts);
    } catch (err) {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDrafts(); }, []);

  return (
    <>
      <div className="products-toolbar">
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.05rem' }}>Rascunhos de Campanha</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            A IA prepara orçamento, palavras-chave e copy. Você cria a campanha
            manualmente no Google Ads — o sistema nunca cria sozinho.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Novo rascunho</button>
      </div>

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : drafts.length === 0 ? (
        <div className="panel">
          <div className="empty-state">Nenhum rascunho ainda. Clique em "+ Novo rascunho" pra começar.</div>
        </div>
      ) : (
        <div className="products-grid">
          {drafts.map(d => (
            <div className="product-card" key={d.id} onClick={() => setOpenDraftId(d.id)} style={{ cursor: 'pointer' }}>
              <div className="product-card-header">
                <div className="product-card-title">{d.name}</div>
              </div>
              <div className="product-card-metrics">
                <div><span>Orçamento/dia</span>{d.currency} {Number(d.daily_budget).toFixed(2)}</div>
              </div>
              <div className="product-card-badges">
                <span className={`badge ${d.status === 'created_in_google_ads' ? 'active' : d.status === 'approved' ? 'paused' : 'blocked'}`}>
                  {STATUS_LABELS[d.status] || d.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CampaignDraftModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); loadDrafts(); }} />
      )}

      {openDraftId && (
        <CampaignDraftDetail draftId={openDraftId} onClose={() => setOpenDraftId(null)} onChanged={loadDrafts} />
      )}
    </>
  );
}
