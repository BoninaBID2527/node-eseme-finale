import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import useMediaQuery from '../hooks/useMediaQuery';
import Avatar from './Avatar';
import Icon from './Icon';
import Logo from './Logo';

function NavItem({ to, icon, label, badge, end }) {
  return (
    <NavLink to={to} end={end} className="nav-item" title={label}>
      <Icon name={icon} size={20} />
      <span className="nav-label">{label}</span>
      {badge > 0 && (
        <span className="nav-badge" aria-label={`${badge} non lette`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );
}

// Barra di navigazione rapida in basso (solo smartphone, solo con la sessione attiva): le cinque destinazioni più usate.
function BottomNav({ unread }) {
  const items = [
    { to: '/dashboard', icon: 'dashboard', label: 'Home' },
    { to: '/catalog', icon: 'compass', label: 'Catalogo' },
    { to: '/projects', icon: 'folder', label: 'Progetti', end: true },
    { to: '/tasks', icon: 'tasks', label: 'Task' },
    { to: '/notifications', icon: 'bell', label: 'Avvisi', badge: unread },
  ];
  return (
    <nav className="bottom-nav" aria-label="Navigazione rapida">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="bottom-nav-item">
          <span className="bottom-nav-icon">
            <Icon name={item.icon} size={22} />
            {item.badge > 0 && <span className="tab-badge" aria-label={`${item.badge} non lette`}>{item.badge > 9 ? '9+' : item.badge}</span>}
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { unread, connected } = useRealtime();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [open, setOpen] = useState(false);
  const mainRef = useRef(null);
  const menuButtonRef = useRef(null);

  // Ad ogni cambio pagina: chiude il menu mobile e porta il focus sul contenuto (utile con tastiera e screen reader).
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  // Menu mobile: Esc per chiudere e scroll della pagina bloccato mentre è aperto.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>
        Vai al contenuto
      </a>

      <header className="topbar">
        <Link to="/" aria-label="BONHUB, pagina iniziale">
          <Logo tone="dark" height={26} decorative />
        </Link>
        <div className="topbar-actions">
          {user && (
            <Link to="/notifications" className="icon-btn icon-btn-dark topbar-bell" aria-label={`Notifiche${unread ? `, ${unread} non lette` : ''}`}>
              <Icon name="bell" size={20} />
              {unread > 0 && <span className="dot-count">{unread > 9 ? '9+' : unread}</span>}
            </Link>
          )}
          <button
            ref={menuButtonRef}
            className="icon-btn icon-btn-dark"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="sidebar"
            aria-label={open ? 'Chiudi il menu' : 'Apri il menu'}
          >
            <Icon name={open ? 'x' : 'menu'} size={22} />
          </button>
        </div>
      </header>

      <div className={`sidebar-backdrop${open ? ' is-open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />

      <aside id="sidebar" className={`sidebar${open ? ' is-open' : ''}`} aria-label="Barra laterale" inert={isMobile && !open ? true : undefined}>
        <Link to="/" className="sidebar-logo" aria-label="BONHUB, pagina iniziale">
          <Logo className="logo-wide" tone="dark" height={30} decorative />
          <Logo className="logo-compact" variant="icon" height={40} decorative />
        </Link>

        {user && (
          <button className="btn btn-primary btn-block sidebar-cta" onClick={() => navigate('/projects/new')} title="Nuovo progetto">
            <Icon name="plus" size={18} />
            <span className="nav-label">Nuovo progetto</span>
          </button>
        )}

        <nav className="nav" aria-label="Navigazione principale">
          {user && (
            <>
              <p className="nav-group">Lavoro</p>
              <NavItem to="/dashboard" icon="dashboard" label="Dashboard" />
              <NavItem to="/projects" icon="folder" label="I miei progetti" end />
              <NavItem to="/tasks" icon="tasks" label="I miei task" />
              <NavItem to="/notifications" icon="bell" label="Notifiche" badge={unread} />
            </>
          )}
          <p className="nav-group">Esplora</p>
          <NavItem to="/catalog" icon="compass" label="Catalogo" />
          {user?.role === 'admin' && (
            <>
              <p className="nav-group">Gestione</p>
              <NavItem to="/admin" icon="shield" label="Amministrazione" />
            </>
          )}
        </nav>

        <div className="sidebar-foot">
          {user ? (
            <>
              <span className={`live${connected ? ' is-on' : ''}`} role="status" title={connected ? 'Aggiornamenti live attivi' : 'Riconnessione in corso…'}>
                <span className="live-dot" aria-hidden="true" />
                <span className="nav-label">{connected ? 'Aggiornamenti live attivi' : 'Riconnessione in corso…'}</span>
              </span>
              <NavLink to="/profile" className="me" title="Profilo">
                <Avatar name={user.name} size={36} />
                <span className="me-text nav-label">
                  <strong>{user.name}</strong>
                  <small>{user.role === 'admin' ? 'Amministratore' : 'Profilo'}</small>
                </span>
              </NavLink>
              <button className="nav-item nav-logout" onClick={handleLogout} title="Esci">
                <Icon name="logout" size={20} />
                <span className="nav-label">Esci</span>
              </button>
            </>
          ) : (
            <div className="auth-links">
              <Link className="btn btn-primary btn-block" to="/login" title="Accedi">
                <Icon name="user" size={18} />
                <span className="nav-label">Accedi</span>
              </Link>
              <Link className="btn btn-dark-ghost btn-block" to="/register">
                <span className="nav-label">Registrati</span>
                <Icon name="plus" size={18} className="rail-only" />
              </Link>
            </div>
          )}
        </div>
      </aside>

      <main id="main" className="main" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>

      {user && isMobile && <BottomNav unread={unread} />}
    </div>
  );
}
