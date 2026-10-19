import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import { EmptyState } from './components/StateMessage';
import { useAuth } from './context/AuthContext';
import Admin from './pages/Admin';
import Catalog from './pages/Catalog';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import MyProjects from './pages/MyProjects';
import MyTasks from './pages/MyTasks';
import NewProject from './pages/NewProject';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import ProjectPage from './pages/ProjectPage';
import Register from './pages/Register';

// La pagina iniziale dipende dalla sessione: dashboard per chi ha fatto l'accesso, catalogo per gli altri.
function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading" role="status">Caricamento…</div>;
  return <Navigate to={user ? '/dashboard' : '/catalog'} replace />;
}

function NotFound() {
  return (
    <div className="page">
      <EmptyState
        icon="compass"
        title="Pagina non trovata"
        text="L'indirizzo che hai aperto non esiste o è stato spostato."
        action={<Link className="btn btn-primary" to="/">Torna alla home</Link>}
      />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<MyProjects />} />
          <Route path="/projects/new" element={<NewProject />} />
          <Route path="/projects/:id" element={<ProjectPage />} />
          <Route path="/tasks" element={<MyTasks />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route element={<RequireAuth admin />}>
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
