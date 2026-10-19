import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Form condiviso da login e registrazione.
export default function AuthForm({ mode }) {
  const isLogin = mode === 'login';
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="brand brand-large">
          <span className="brand-mark">✓</span> TaskFlow
        </div>
        <h1>{isLogin ? 'Bentornato' : 'Crea il tuo account'}</h1>
        <p className="muted">
          {isLogin ? 'Accedi per gestire i tuoi progetti.' : 'Organizza il lavoro di gruppo in una bacheca condivisa.'}
        </p>

        <form onSubmit={submit} className="form">
          {!isLogin && (
            <label>
              Nome
              <input value={form.name} onChange={update('name')} required autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input type="email" value={form.email} onChange={update('email')} required autoComplete="email" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              required
              minLength={isLogin ? undefined : 6}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {isLogin ? 'Accedi' : 'Registrati'}
          </button>
        </form>

        <p className="auth-switch muted">
          {isLogin ? (
            <>
              Non hai un account? <Link to="/register">Registrati</Link>
            </>
          ) : (
            <>
              Hai già un account? <Link to="/login">Accedi</Link>
            </>
          )}
          {' · '}
          <Link to="/catalog">Esplora il catalogo</Link>
        </p>
      </div>
    </div>
  );
}
