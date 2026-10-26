import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Avatar from '../components/Avatar';
import Field from '../components/Field';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { errorMessage, formatDate } from '../utils';

export default function Profile() {
  useDocumentTitle('Profilo');
  const { user, setUser, saveSession, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user.name);
  const [nameErrors, setNameErrors] = useState({});
  const [savingName, setSavingName] = useState(false);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    setNameErrors({});
    setSavingName(true);
    try {
      const data = await api.patch('/auth/me', { name });
      setUser(data.user);
      toast('Profilo aggiornato', 'success');
    } catch (err) {
      if (err.fields) setNameErrors(err.fields);
      else toast(errorMessage(err), 'error');
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwErrors({});
    setSavingPw(true);
    try {
      // Il server restituisce un nuovo token: quelli emessi prima del cambio non valgono più.
      saveSession(await api.patch('/auth/password', pw));
      setPw({ currentPassword: '', newPassword: '' });
      toast('Password aggiornata', 'success');
    } catch (err) {
      if (err.fields) setPwErrors(err.fields);
      else toast(errorMessage(err), 'error');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="page page-narrow">
      <PageHeader eyebrow="Account" title="Profilo" lead="Gestisci i tuoi dati, la sicurezza dell'account e la sessione." />

      <section className="card profile-card" aria-label="Il tuo account">
        <Avatar name={user.name} size={72} />
        <div className="grow">
          <h2>{user.name}</h2>
          <p className="muted truncate">{user.email}</p>
          <p className="profile-meta">
            <span className={`role-tag${user.role === 'admin' ? ' is-owner' : ''}`}>{user.role === 'admin' ? 'Amministratore' : 'Utente'}</span>
            <span className="muted">Iscritto dal {formatDate(user.createdAt)}</span>
          </p>
        </div>
      </section>

      <section className="card panel" aria-labelledby="p-data">
        <div className="panel-title">
          <Icon name="user" size={20} />
          <div>
            <h2 id="p-data">Dati personali</h2>
            <p className="muted">Il nome compare accanto ai tuoi task, messaggi e commenti.</p>
          </div>
        </div>
        <form className="form" onSubmit={saveName} noValidate>
          <Field label="Nome" error={nameErrors.name}>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label="Email" hint="L'email è il tuo identificativo di accesso e non si può modificare.">
            <input value={user.email} readOnly disabled />
          </Field>
          <div className="form-actions">
            <button className={`btn btn-primary${savingName ? ' is-loading' : ''}`} disabled={savingName || name.trim() === user.name}>
              Salva modifiche
            </button>
          </div>
        </form>
      </section>

      <section className="card panel" aria-labelledby="p-pw">
        <div className="panel-title">
          <Icon name="lock" size={20} />
          <div>
            <h2 id="p-pw">Password</h2>
            <p className="muted">Cambiandola, le altre sessioni aperte verranno chiuse.</p>
          </div>
        </div>
        <form className="form" onSubmit={savePassword} noValidate>
          <Field label="Password attuale" error={pwErrors.currentPassword}>
            <input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          </Field>
          <Field label="Nuova password" error={pwErrors.newPassword} hint="Almeno 8 caratteri.">
            <input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          </Field>
          <div className="form-actions">
            <button className={`btn btn-primary${savingPw ? ' is-loading' : ''}`} disabled={savingPw || !pw.currentPassword || !pw.newPassword}>
              Cambia password
            </button>
          </div>
        </form>
      </section>

      <section className="card panel panel-session" aria-labelledby="p-session">
        <div className="panel-title">
          <Icon name="logout" size={20} />
          <div>
            <h2 id="p-session">Sessione</h2>
            <p className="muted">Esci da BONTASK su questo dispositivo. La sessione viene invalidata anche sul server.</p>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn" onClick={async () => { await logout(); navigate('/login'); }}>
            <Icon name="logout" size={16} /> Esci
          </button>
        </div>
      </section>
    </div>
  );
}
