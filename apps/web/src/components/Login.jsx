import { useState } from 'react';
import { api, setAdminKey } from '../api/client';

export default function Login({ onSuccess }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setError('');
    setAdminKey(key.trim());
    try {
      await api.get('/dashboard/summary');
      onSuccess();
    } catch (err) {
      setError('Chave de acesso inválida.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Plataforma de Afiliados + IA</h1>
        <p className="sub">Informe a chave de acesso definida no .env (ADMIN_KEY)</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="admin-key">Chave de acesso</label>
            <input id="admin-key" type="password" value={key} onChange={e => setKey(e.target.value)} autoFocus />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <div className="form-msg error">{error}</div>
        </form>
      </div>
    </div>
  );
}
