import { NavLink } from 'react-router-dom';
import { clearSession, getCurrentUser } from '../api/client';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/campaigns', label: 'Campanhas · IA' },
  { to: '/alerts', label: 'Alertas' },
  { to: '/products', label: 'Produtos' },
  { to: '/market-intel', label: 'Mercado' },
  { to: '/competitive-intel', label: 'Concorrência' },
  { to: '/campaign-drafts', label: 'Rascunhos de Campanha' },
  { to: '/accounts', label: 'Contas' },
  { to: '/users', label: 'Usuários' },
];

export default function Layout({ children }) {
  const currentUser = getCurrentUser();

  function handleLogout() {
    clearSession();
    window.location.reload();
  }

  // "Usuários" só aparece pra quem logou com perfil administrador (via JWT).
  // Sessão antiga por ADMIN_KEY não tem currentUser — nesse caso mostra tudo,
  // igual sempre foi (retrocompatibilidade, ver shared/auth/middleware.js).
  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.to !== '/users') return true;
    return !currentUser || currentUser.role === 'administrador';
  });

  return (
    <div>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="brand"><span className="brand-dot" /> Plataforma de Afiliados + IA</div>
          <div className="nav-links">
            {visibleItems.map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                className={({ isActive }) => isActive ? 'active' : ''}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="topbar-actions">
          {currentUser && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 10 }}>{currentUser.name || currentUser.email}</span>}
          <button className="btn" onClick={handleLogout}>Sair</button>
        </div>
      </div>
      <div className="container">{children}</div>
    </div>
  );
}
