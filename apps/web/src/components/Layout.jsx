import { NavLink } from 'react-router-dom';
import { clearAdminKey } from '../api/client';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/campaigns', label: 'Campanhas · IA' },
  { to: '/alerts', label: 'Alertas' },
  { to: '/products', label: 'Produtos' },
  { to: '/market-intel', label: 'Mercado' },
  { to: '/competitive-intel', label: 'Concorrência' },
];

export default function Layout({ children }) {
  function handleLogout() {
    clearAdminKey();
    window.location.reload();
  }

  return (
    <div>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="brand"><span className="brand-dot" /> Plataforma de Afiliados + IA</div>
          <div className="nav-links">
            {NAV_ITEMS.map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                className={({ isActive }) => isActive ? 'active' : ''}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={handleLogout}>Sair</button>
        </div>
      </div>
      <div className="container">{children}</div>
    </div>
  );
}
