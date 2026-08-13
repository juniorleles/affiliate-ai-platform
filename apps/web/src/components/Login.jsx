import { useEffect, useState } from 'react';
import { api, setAuthToken, setCurrentUser } from '../api/client';

export default function Login({ onSuccess }) {
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [isFirstAccess, setIsFirstAccess] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/staff/auth/status')
      .then(data => setIsFirstAccess(!data.hasUsers))
      .catch(() => setIsFirstAccess(false))
      .finally(() => setCheckingStatus(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const path = isFirstAccess ? '/staff/auth/bootstrap' : '/staff/auth/login';
      const body = isFirstAccess ? { email, password, name } : { email, password };
      const data = await api.post(path, body);
      setAuthToken(data.token);
      setCurrentUser(data.user);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingStatus) {
    return <div className="auth-wrap"><div className="auth-card"><div className="empty-state">Carregando...</div></div></div>;
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Plataforma de Afiliados + IA</h1>
        <p className="sub">
          {isFirstAccess
            ? 'Primeiro acesso — crie a conta de administrador.'
            : 'Entre com seu e-mail e senha.'}
        </p>
        <form onSubmit={handleSubmit}>
          {isFirstAccess && (
            <div className="field">
              <label htmlFor="name">Nome</label>
              <input id="name" value={name} onChange={e => setName(e.target.value)} autoFocus />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus={!isFirstAccess} />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            {isFirstAccess && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mínimo 8 caracteres.</span>}
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Entrando...' : isFirstAccess ? 'Criar conta de administrador' : 'Entrar'}
          </button>
          {error && <div className="form-msg error">{error}</div>}
        </form>
      </div>
    </div>
  );
}
