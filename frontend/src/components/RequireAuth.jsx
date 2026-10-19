import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Protegge un gruppo di rotte: serve il login (e, con `admin`, il ruolo di amministratore).
// Nota: è solo comodità per l'utente; i permessi veri sono controllati dal server su ogni API.
export default function RequireAuth({ admin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-loading" role="status">Caricamento…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
