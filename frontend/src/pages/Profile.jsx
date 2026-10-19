import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Avatar from '../components/Avatar';
import Field from '../components/Field';
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
      <header className="page-head">
        <div className="profile-head">
          <Avatar name={user.name} size={64} />
          <div>
            <h1 className="page-title">{user.name}</h1>
            <p className="page-lead">
              {user.role === 'admin' ? 'Amministratore' : 'Utente'} · iscritto dal {formatDate(user.createdAt)}
            </p>
          </div>
        </div>
      </header>

      <section className="card panel" aria-labelledby="p-data">
        <h2 id="p-data">Dati personali</h2>
        <form className="form" onSubmit={saveName} noValidate>
          <Field label="Nome" error={nameErrors.name}>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label="Email" hint="L'email è il tuo identificativo di accesso e non si può modificare.">
            <input value={user.email} readOnly disabled />
          </Field>
          <div>
            <button className="btn btn-primary" disabled={savingName || name.trim() === user.name}>
              Salva modifiche
            </button>
          </div>
        </form>
      </section>

      <section className="card panel" aria-labelledby="p-pw">
        <h2 id="p-pw">Password</h2>
        <form className="form" onSubmit={savePassword} noValidate>
          <Field label="Password attuale" error={pwErrors.currentPassword}>
            <input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          </Field>
          <Field label="Nuova password" error={pwErrors.newPassword} hint="Almeno 8 caratteri. Cambiandola, le altre sessioni aperte verranno chiuse.">
            <input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          </Field>
          <div>
            <button className="btn btn-primary" disabled={savingPw || !pw.currentPassword || !pw.newPassword}>
              Cambia password
            </button>
          </div>
        </form>
      </section>

      <section className="card panel" aria-labelledby="p-session">
        <h2 id="p-session">Sessione</h2>
        <p className="muted">Esci da TaskFlow su questo dispositivo. La sessione viene invalidata anche sul server.</p>
        <div>
          <button className="btn" onClick={async () => { await logout(); navigate('/login'); }}>
            Esci
          </button>
        </div>
      </section>
    </div>
  );
}
