import { useState } from 'react';
import { api } from '../../api/client';

export default function McCModal({ onClose, onSaved }) {
  const [mccCustomerId, setMccCustomerId] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!mccCustomerId.trim() || !name.trim()) {
      setError('ID da MCC e nome são obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/campaigns/mccs', { mccCustomerId: mccCustomerId.trim(), name: name.trim(), notes: notes.trim() || undefined });
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
          <h2>Nova MCC</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field field-full">
            <label>ID da MCC (customer_id) *</label>
            <input value={mccCustomerId} onChange={e => setMccCustomerId(e.target.value)} placeholder="123-456-7890" />
          </div>
          <div className="field field-full">
            <label>Nome *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="MCC Principal" />
          </div>
          <div className="field field-full">
            <label>Notas</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
          {error && <div className="form-msg error">{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Salvando...' : 'Cadastrar MCC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
