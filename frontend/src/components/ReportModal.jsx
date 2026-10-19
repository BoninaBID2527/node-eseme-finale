import { useState } from 'react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils';
import Field from './Field';
import Icon from './Icon';
import Modal from './Modal';

const REASONS = ['Spam o pubblicità', 'Contenuto inappropriato', 'Duplicato di un altro progetto', 'Informazioni false'];

export default function ReportModal({ project, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/projects/${project._id}/report`, { reason });
      toast('Segnalazione inviata agli amministratori', 'success');
      onClose();
    } catch (err) {
      setError(err.fields?.reason || errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Segnala il progetto" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <p className="muted">Gli amministratori esamineranno la segnalazione di "{project.title}". Descrivi cosa non va.</p>
        <div className="report-suggestions" role="group" aria-label="Motivi più comuni">
          {REASONS.map((r) => (
            <button key={r} type="button" className="pill-btn" aria-pressed={reason === r} onClick={() => setReason(r)}>
              {r}
            </button>
          ))}
        </div>
        <Field label="Motivo" error={error} hint="Almeno 5 caratteri" counter={`${reason.length}/500`}>
          <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} data-autofocus />
        </Field>
        <p className="report-note">
          <Icon name="info" size={16} /> La segnalazione è visibile solo agli amministratori e non annuncia nulla al proprietario del progetto.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Annulla</button>
          <button className={`btn btn-primary${busy ? ' is-loading' : ''}`} disabled={busy || reason.trim().length < 1} aria-busy={busy}>
            <span>Invia segnalazione</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
