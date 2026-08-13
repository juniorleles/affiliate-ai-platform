import { useEffect, useState } from 'react';
import { api, getCurrentUser } from '../../api/client';

const ROLES = ['administrador', 'gerente', 'operador', 'visualizador'];
const ROLE_LABELS = {
  administrador: 'Administrador', gerente: 'Gerente', operador: 'Operador', visualizador: 'Visualizador',
};

export default function UsersPage() {
  const currentUser = getCurrentUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('visualizador');
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await api.get('/staff/users');
      setUsers(data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/staff/users', { email, password, name, role });
      setShowForm(false);
      setEmail(''); setPassword(''); setName(''); setRole('visualizador');
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(id, newRole) {
    await api.patch(`/staff/users/${id}`, { role: newRole });
    loadUsers();
  }

  async function handleToggleActive(user) {
    await api.patch(`/staff/users/${user.id}`, { isActive: !user.is_active });
    loadUsers();
  }

  if (currentUser && currentUser.role !== 'administrador') {
    return (
      <div className="panel">
        <div className="empty-state">Esta tela é só pra administradores. Seu perfil atual: {ROLE_LABELS[currentUser.role] || currentUser.role}.</div>
      </div>
    );
  }

  return (
    <>
      <div className="products-toolbar">
        <h2 style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.05rem' }}>Usuários</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Novo usuário'}
        </button>
      </div>

      {showForm && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <form onSubmit={handleCreate}>
            <div className="form-grid">
              <div className="field"><label>Nome</label><input value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="field"><label>E-mail *</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div className="field"><label>Senha *</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
              <div className="field">
                <label>Perfil</label>
                <select value={role} onChange={e => setRole(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 10 }}>
              {saving ? 'Salvando...' : 'Cadastrar usuário'}
            </button>
          </form>
        </div>
      )}

      {error && <div className="form-msg error">{error}</div>}

      <div className="panel">
        {loading ? (
          <div className="empty-state">Carregando...</div>
        ) : (
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="name-cell">{u.name || '—'}</td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                      style={{ background: 'var(--panel-raised)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.78rem', padding: '3px 6px' }}>
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td><span className={`badge ${u.is_active ? 'active' : 'blocked'}`}>{u.is_active ? 'Ativo' : 'Inativo'}</span></td>
                  <td><button className="btn" onClick={() => handleToggleActive(u)}>{u.is_active ? 'Desativar' : 'Ativar'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
