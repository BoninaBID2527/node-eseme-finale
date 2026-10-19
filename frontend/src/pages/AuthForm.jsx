import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Field from '../components/Field';
import Icon from '../components/Icon';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

// Form condiviso da accesso e registrazione. Gli errori del server compaiono accanto ai singoli campi.
export default function AuthForm({ mode }) {
  const isLogin = mode === 'login';
  useDocumentTitle(isLogin ? 'Accedi' : 'Registrati');
  const { user, login, register, notice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const update = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
  };

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setFormError('');
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      else setFormError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <aside className="auth-aside">
        <Link to="/catalog" className="auth-brand" aria-label="TaskFlow, vai al catalogo">
          <Logo size={40} />
        </Link>
        <div className="auth-pitch">
          <h2>Il lavoro di gruppo, un passo dopo l'altro.</h2>
          <ul>
            <li><Icon name="board" size={20} /> Bacheca condivisa con colonne Da fare, In corso e Completato</li>
            <li><Icon name="message" size={20} /> Chat di progetto riservata ai membri</li>
            <li><Icon name="bell" size={20} /> Notifiche in tempo reale su task e inviti</li>
          </ul>
        </div>
        <div className="auth-art" aria-hidden="true">
          <span style={{ width: '34%' }} />
          <span style={{ width: '46%', marginLeft: '22%' }} className="is-yellow" />
          <span style={{ width: '38%', marginLeft: '48%' }} />
        </div>
      </aside>

      <main className="auth-main" id="main">
        <div className="auth-card">
          <h1>{isLogin ? 'Bentornato' : 'Crea il tuo account'}</h1>
          <p className="muted">{isLogin ? 'Accedi per gestire i tuoi progetti.' : 'Bastano pochi secondi per iniziare.'}</p>

          {isLogin && notice && (
            <p className="form-notice" role="alert">
              {notice}
            </p>
          )}

          <form onSubmit={submit} className="form" noValidate>
            {!isLogin && (
              <Field label="Nome" error={errors.name}>
                <input value={form.name} onChange={update('name')} autoComplete="name" required />
              </Field>
            )}
            <Field label="Email" error={errors.email}>
              <input type="email" value={form.email} onChange={update('email')} autoComplete="email" required />
            </Field>
            <Field label="Password" error={errors.password} hint={isLogin ? undefined : 'Almeno 8 caratteri'}>
              <input
                type="password"
                value={form.password}
                onChange={update('password')}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
              />
            </Field>
            {formError && (
              <p className="form-alert" role="alert">
                {formError}
              </p>
            )}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Un momento…' : isLogin ? 'Accedi' : 'Registrati'}
            </button>
          </form>

          <p className="auth-switch">
            {isLogin ? (
              <>
                Non hai un account? <Link to="/register">Registrati</Link>
              </>
            ) : (
              <>
                Hai già un account? <Link to="/login">Accedi</Link>
              </>
            )}
          </p>
          <p className="auth-switch">
            <Link to="/catalog">Esplora il catalogo pubblico</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
