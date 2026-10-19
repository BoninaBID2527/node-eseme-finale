import { useState } from 'react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils';
import Field from './Field';
import Modal from './Modal';

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
        <Field label="Motivo" error={error} hint="Almeno 5 caratteri">
          <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} data-autofocus />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" disabled={busy || reason.trim().length < 1}>Invia segnalazione</button>
        </div>
      </form>
    </Modal>
  );
}
