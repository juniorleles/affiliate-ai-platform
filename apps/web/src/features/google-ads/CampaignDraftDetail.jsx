import { useEffect, useState } from 'react';
import { api, BASE_URL, getAdminKey } from '../../api/client';

const STATUS_LABELS = {
  draft: 'Rascunho', approved: 'Aprovado — pronto pra usar', created_in_google_ads: 'Já criado no Google Ads',
};

export default function CampaignDraftDetail({ draftId, onClose, onChanged }) {
  const [draft, setDraft] = useState(null);
  const [copyText, setCopyText] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api.get(`/campaigns/drafts/${draftId}`);
    setDraft(data.draft);

    const res = await fetch(`${BASE_URL}/api/campaigns/drafts/${draftId}/copy-text`, {
      headers: { 'x-admin-key': getAdminKey() },
    });
    setCopyText(await res.text());
  }

  useEffect(() => { load(); }, [draftId]);

  async function handleApprove() {
    setBusy(true);
    try {
      await api.post(`/campaigns/drafts/${draftId}/approve`);
      await load();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkUsed() {
    setBusy(true);
    try {
      await api.post(`/campaigns/drafts/${draftId}/mark-as-used`, {});
      await load();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!draft) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h2>{draft.name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <span className={`badge ${draft.status === 'created_in_google_ads' ? 'active' : draft.status === 'approved' ? 'paused' : 'blocked'}`}>
            {STATUS_LABELS[draft.status] || draft.status}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Orçamento: {draft.currency} {Number(draft.daily_budget).toFixed(2)}/dia
          </span>
        </div>

        <textarea
          readOnly
          value={copyText}
          rows={16}
          style={{
            width: '100%', background: 'var(--panel-raised)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '12px', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.8rem', resize: 'vertical', lineHeight: 1.6,
          }}
        />

        {draft.ai_copy_reasoning && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 10 }}>
            <b style={{ color: 'var(--text)' }}>Por que essa copy:</b> {draft.ai_copy_reasoning}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn" onClick={handleCopy} style={{ flex: 1 }}>
            {copied ? '✓ Copiado!' : 'Copiar tudo'}
          </button>
          {draft.status === 'draft' && (
            <button className="btn btn-primary" onClick={handleApprove} disabled={busy} style={{ flex: 1 }}>
              Aprovar rascunho
            </button>
          )}
          {draft.status === 'approved' && (
            <button className="btn btn-primary" onClick={handleMarkUsed} disabled={busy} style={{ flex: 1 }}>
              Marcar como criado no Google Ads
            </button>
          )}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>
          "Marcar como criado" é só pra manter seu histórico — o sistema não cria
          nada no Google Ads sozinho, você faz isso manualmente com os dados acima.
        </p>
      </div>
    </div>
  );
}
