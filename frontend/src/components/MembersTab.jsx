import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useRealtime } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import useAsync from '../hooks/useAsync';
import { errorMessage, timeAgo } from '../utils';
import Avatar from './Avatar';
import Field from './Field';
import Icon from './Icon';

// Membri del progetto. Il proprietario invita (l'utente deve accettare), annulla inviti e rimuove membri;
// un membro può lasciare il progetto. Gli estranei vedono solo i nomi.
export default function MembersTab({ project, isOwner, isMember, writable, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { resyncKey } = useRealtime();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [busy, setBusy] = useState(false);

  const invitations = useAsync(() => (isOwner ? api.get(`/projects/${project._id}/invitations`) : Promise.resolve({ invitations: [] })), [project._id, isOwner, resyncKey, project.members.length]);

  useEffect(() => setEmailError(''), [email]);

  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setEmailError('');
    try {
      await api.post(`/projects/${project._id}/invitations`, { email });
      toast('Invito inviato: l\'utente entrerà nel progetto quando lo accetta', 'success');
      setEmail('');
      invitations.reload({ silent: true });
    } catch (err) {
      setEmailError(err.fields?.email || errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const cancelInvitation = async (inv) => {
    try {
      await api.delete(`/projects/${project._id}/invitations/${inv._id}`);
      toast('Invito annullato', 'success');
      invitations.reload({ silent: true });
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const removeMember = async (member) => {
    const ok = await confirm({
      title: `Rimuovere ${member.name}?`,
      message: 'Perderà l\'accesso a bacheca e chat e i task che gli erano assegnati resteranno senza assegnatario.',
      confirmLabel: 'Rimuovi',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/projects/${project._id}/members/${member._id}`);
      toast(`${member.name} è stato rimosso`, 'success');
      onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const leave = async () => {
    const ok = await confirm({
      title: 'Lasciare il progetto?',
      message: 'Non vedrai più bacheca e chat. I task assegnati a te resteranno senza assegnatario. Per rientrare servirà un nuovo invito.',
      confirmLabel: 'Lascia il progetto',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.post(`/projects/${project._id}/leave`);
      toast('Hai lasciato il progetto', 'success');
      navigate('/projects');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const people = [{ ...project.owner, isOwner: true }, ...project.members];

  return (
    <div className="members-layout">
      <section className="card panel" aria-labelledby="members-title">
        <div className="panel-title-row">
          <h2 id="members-title">Membri <span className="tab-count">{people.length}</span></h2>
        </div>
        <ul className="member-list" data-testid="members">
          {people.map((m) => (
            <li key={m._id} className={`member${m.isOwner ? ' is-owner' : ''}`}>
              <Avatar name={m.name} size={40} />
              <div className="grow">
                <strong>
                  {m.name}
                  {m._id === user._id && <span className="member-you"> (tu)</span>}
                </strong>
                {m.email && <small className="muted truncate">{m.email}</small>}
              </div>
              <span className={`role-chip${m.isOwner ? ' is-owner' : ''}`}>{m.isOwner ? 'Proprietario' : 'Membro'}</span>
              {isOwner && !m.isOwner && writable && (
                <button className="btn btn-sm btn-danger-ghost" onClick={() => removeMember(m)} aria-label={`Rimuovi ${m.name} dal progetto`}>
                  Rimuovi
                </button>
              )}
            </li>
          ))}
        </ul>
        {isMember && !isOwner && writable && (
          <div className="panel-foot leave-zone">
            <div>
              <strong>Lascia il progetto</strong>
              <p className="muted">Perderai l'accesso a bacheca e chat. Per rientrare servirà un nuovo invito.</p>
            </div>
            <button className="btn btn-danger-ghost" onClick={leave}>
              <Icon name="logout" size={16} /> Lascia il progetto
            </button>
          </div>
        )}
      </section>

      {isOwner && (
        <section className="card panel" aria-labelledby="invite-title">
          <h2 id="invite-title">Invita una persona</h2>
          {writable ? (
            <form className="invite-form" onSubmit={invite} noValidate>
              <Field label="Email dell'utente" error={emailError} hint="Deve essere già registrato a BONTASK. Riceverà un invito da accettare.">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@esempio.it" autoComplete="off" required />
              </Field>
              <button className={`btn btn-primary${busy ? ' is-loading' : ''}`} disabled={busy || !email}>
                <Icon name="mail" size={16} /> Invia invito
              </button>
            </form>
          ) : (
            <p className="muted">Il progetto non è modificabile: gli inviti sono disattivati.</p>
          )}

          <div className="panel-divider" />
          <h3 className="panel-subtitle">Inviti in attesa</h3>
          {invitations.data?.invitations.length ? (
            <ul className="member-list" data-testid="pending-invitations">
              {invitations.data.invitations.map((inv) => (
                <li key={inv._id} className="member">
                  <Avatar name={inv.invitee.name} size={32} />
                  <div className="grow">
                    <strong>{inv.invitee.name}</strong>
                    <small className="muted truncate">{inv.invitee.email} · invitato {timeAgo(inv.createdAt)}</small>
                  </div>
                  <span className="role-chip is-pending">In attesa</span>
                  <button className="btn btn-sm" onClick={() => cancelInvitation(inv)} aria-label={`Annulla l'invito a ${inv.invitee.name}`}>
                    Annulla
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nessun invito in attesa.</p>
          )}
        </section>
      )}
    </div>
  );
}
