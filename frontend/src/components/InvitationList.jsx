import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useRealtime } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils';
import Icon from './Icon';

// Inviti ricevuti: l'utente entra nel progetto solo se accetta.
export default function InvitationList({ invitations, onChanged }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { refreshUnread } = useRealtime();
  const [busyId, setBusyId] = useState(null);

  const respond = async (invitation, action) => {
    setBusyId(invitation._id);
    try {
      const data = await api.post(`/invitations/${invitation._id}/${action}`);
      refreshUnread();
      if (action === 'accept') {
        toast(`Sei entrato in "${invitation.project.title}"`, 'success');
        navigate(`/projects/${data.project._id}?tab=board`);
      } else {
        toast('Invito rifiutato', 'info');
        onChanged();
      }
    } catch (err) {
      toast(errorMessage(err), 'error');
      onChanged(); // l'invito potrebbe essere stato annullato nel frattempo
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ul className="invitations">
      {invitations.map((inv) => (
        <li key={inv._id} className="invitation">
          <span className="invitation-icon">
            <Icon name="user-plus" size={20} />
          </span>
          <div className="grow">
            <p>
              <strong>{inv.inviter?.name}</strong> ti ha invitato in <strong>{inv.project.title}</strong>
            </p>
            {inv.project.description && <small className="muted clamp-2">{inv.project.description}</small>}
          </div>
          <div className="invitation-actions">
            <button className="btn btn-primary btn-sm" onClick={() => respond(inv, 'accept')} disabled={busyId === inv._id}>
              Accetta
            </button>
            <button className="btn btn-sm" onClick={() => respond(inv, 'decline')} disabled={busyId === inv._id}>
              Rifiuta
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
