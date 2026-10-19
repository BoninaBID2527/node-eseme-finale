import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import Avatar from './Avatar';

const Icon = ({ d }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <NavLink to="/" className="brand">
            <span className="brand-mark">✓</span> TaskFlow
          </NavLink>
          {user && <NotificationBell />}
        </div>

        <nav className="nav">
          <NavLink to="/catalog">
            <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" /> Catalogo
          </NavLink>
          {user && (
            <NavLink to="/dashboard">
              <Icon d="M3 12l9-9 9 9M5 10v10h14V10" /> Dashboard
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/admin">
              <Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /> Admin
            </NavLink>
          )}
        </nav>

        {user && (
          <button className="btn btn-primary sidebar-cta" onClick={() => navigate('/projects/new')}>
            + Nuovo progetto
          </button>
        )}

        <div className="sidebar-bottom">
          {user ? (
            <>
              <div className="me">
                <Avatar name={user.name} size={34} />
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.role === 'admin' ? 'Amministratore' : 'Utente'}</small>
                </div>
              </div>
              <button className="link-btn" onClick={handleLogout}>
                Esci
              </button>
            </>
          ) : (
            <div className="auth-links">
              <NavLink className="btn btn-primary" to="/login">
                Accedi
              </NavLink>
              <NavLink className="btn" to="/register">
                Registrati
              </NavLink>
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
