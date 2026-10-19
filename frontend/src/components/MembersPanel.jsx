import { useState } from 'react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import Avatar from './Avatar';

export default function MembersPanel({ project, isOwner, onChange }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api.post(`/projects/${project._id}/members`, { email });
      onChange(data.project);
      setEmail('');
      toast('Membro aggiunto al progetto', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (member) => {
    if (!window.confirm(`Rimuovere ${member.name} dal progetto?`)) return;
    try {
      await api.delete(`/projects/${project._id}/members/${member._id}`);
      onChange({ ...project, members: project.members.filter((m) => m._id !== member._id) });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="members">
      <ul>
        <li>
          <Avatar name={project.owner.name} size={34} />
          <div>
            <strong>{project.owner.name}</strong>
            <small>Proprietario</small>
          </div>
        </li>
        {project.members.map((m) => (
          <li key={m._id}>
            <Avatar name={m.name} size={34} />
            <div>
              <strong>{m.name}</strong>
              <small>{m.email}</small>
            </div>
            {isOwner && (
              <button className="link-btn danger" onClick={() => remove(m)} aria-label={`Rimuovi ${m.name}`}>
                Rimuovi
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <form onSubmit={invite} className="invite">
          <label>
            Invita per email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@esempio.it" required />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            Invita
          </button>
        </form>
      )}
    </div>
  );
}
