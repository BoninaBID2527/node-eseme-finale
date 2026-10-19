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
  const [showPassword, setShowPassword] = useState(false);

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

  const errorCount = Object.values(errors).filter(Boolean).length;
  const passwordOk = form.password.length >= 8;

  return (
    <div className="auth">
      <aside className="auth-aside">
        <Link to="/catalog" className="auth-brand" aria-label="BONHUB, vai al catalogo">
          <Logo tone="dark" height={40} decorative />
        </Link>

        <div className="auth-pitch">
          <p className="eyebrow is-marked">Gestione progetti per team</p>
          <h2>Il lavoro di gruppo, un passo dopo l'altro.</h2>
          <ul className="auth-points">
            <li>
              <span className="auth-point-icon"><Icon name="board" size={18} /></span>
              <span><strong>Bacheca condivisa</strong> con colonne Da fare, In corso e Completato</span>
            </li>
            <li>
              <span className="auth-point-icon"><Icon name="bell" size={18} /></span>
              <span><strong>Chat e notifiche live</strong> su task, inviti e messaggi di progetto</span>
            </li>
            <li>
              <span className="auth-point-icon"><Icon name="compass" size={18} /></span>
              <span><strong>Catalogo pubblico</strong> per trovare il progetto a cui unirti</span>
            </li>
          </ul>
        </div>

        {/* Motivo grafico: barre arrotondate che salgono a gradini verso l'alto a destra, come l'avanzamento di un progetto. */}
        <svg className="auth-art" viewBox="0 0 360 150" aria-hidden="true" focusable="false">
          <rect className="auth-bar" x="0" y="118" width="150" height="26" rx="13" />
          <rect className="auth-bar" x="52" y="80" width="190" height="26" rx="13" />
          <rect className="auth-bar" x="112" y="42" width="170" height="26" rx="13" />
          <rect className="auth-bar is-accent" x="170" y="4" width="130" height="26" rx="13" />
          <path className="auth-arrow" d="M312 34 L338 8 M316 8 H338 V30" />
        </svg>
      </aside>

      <main className="auth-main" id="main">
        <div className="auth-card">
          <Logo className="auth-mobile-logo" variant="icon" height={44} decorative />
          <div className="auth-heading">
            <p className="eyebrow">{isLogin ? 'Accedi a BONHUB' : 'Nuovo account'}</p>
            <h1>{isLogin ? 'Bentornato' : 'Crea il tuo account'}</h1>
            <p className="muted">{isLogin ? 'Accedi per gestire i tuoi progetti.' : 'Bastano pochi secondi per iniziare.'}</p>
          </div>

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
              <input type="email" value={form.email} onChange={update('email')} autoComplete="email" autoCapitalize="off" spellCheck={false} required />
            </Field>
            <Field
              label="Password"
              error={errors.password}
              hint={
                isLogin ? undefined : (
                  <span className={`password-rule${passwordOk ? ' is-ok' : ''}`}>
                    <Icon name={passwordOk ? 'check-circle' : 'info'} size={14} /> Almeno 8 caratteri
                  </span>
                )
              }
              adornment={
                <button
                  type="button"
                  className="input-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Nascondi la password' : 'Mostra la password'}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                </button>
              }
            >
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={update('password')}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
              />
            </Field>
            {errorCount > 0 && (
              <p className="form-alert" role="alert">
                {errorCount === 1 ? 'Un campo non è corretto: controlla il messaggio indicato.' : `${errorCount} campi non sono corretti: controlla i messaggi indicati.`}
              </p>
            )}
            {formError && (
              <p className="form-alert" role="alert">
                {formError}
              </p>
            )}
            <button className={`btn btn-primary btn-lg btn-block${busy ? ' is-loading' : ''}`} disabled={busy} aria-busy={busy}>
              <span>{isLogin ? 'Accedi' : 'Registrati'}</span>
            </button>
          </form>

          <div className="auth-footer">
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
            <Link to="/catalog" className="auth-explore">
              Esplora il catalogo pubblico <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
