import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils';
import Icon from './Icon';
import ProjectForm from './ProjectForm';

// Impostazioni (solo proprietario): modifica, archiviazione e cancellazione.
export default function SettingsTab({ project, onUpdated }) {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const archived = project.status === 'archived';
  const hidden = project.status === 'hidden';

  const save = async (body) => {
    const data = await api.put(`/projects/${project._id}`, body);
    onUpdated(data.project);
    toast('Progetto aggiornato', 'success');
  };

  const toggleArchive = async () => {
    const ok = await confirm({
      title: archived ? 'Riattivare il progetto?' : 'Archiviare il progetto?',
      message: archived
        ? 'Il progetto tornerà modificabile: task, chat e inviti saranno di nuovo attivi.'
        : 'Il progetto diventa di sola lettura per tutti: task, chat, inviti e modifiche vengono bloccati e il progetto esce dal catalogo. Potrai riattivarlo in qualsiasi momento.',
      confirmLabel: archived ? 'Riattiva' : 'Archivia',
    });
    if (!ok) return;
    try {
      const data = await api.patch(`/projects/${project._id}/archive`, { archived: !archived });
      onUpdated({ status: data.project.status });
      toast(archived ? 'Progetto riattivato' : 'Progetto archiviato', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Eliminare "${project.title}"?`,
      message: 'Il progetto verrà cancellato definitivamente insieme a task, messaggi, inviti e segnalazioni. I membri perderanno l\'accesso. Questa azione non si può annullare.',
      confirmLabel: 'Elimina definitivamente',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/projects/${project._id}`);
      toast('Progetto eliminato', 'success');
      navigate('/projects');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="settings-layout">
      <section className="card panel" aria-labelledby="set-edit">
        <h2 id="set-edit">Modifica il progetto</h2>
        {(archived || hidden) && (
          <p className="form-notice">
            {archived ? 'Il progetto è archiviato: riattivalo per modificarne le informazioni.' : 'Il progetto è stato oscurato da un amministratore e non è modificabile.'}
          </p>
        )}
        <ProjectForm key={project.updatedAt} project={project} onSubmit={save} submitLabel="Salva modifiche" disabled={archived || hidden} />
      </section>

      <section className="card panel danger-zone" aria-labelledby="set-danger">
        <h2 id="set-danger">Stato e cancellazione</h2>
        <div className="danger-row">
          <div>
            <strong>{archived ? 'Riattiva il progetto' : 'Archivia il progetto'}</strong>
            <p className="muted">
              {archived ? 'Torna a poter modificare task, chat e inviti.' : 'Sola lettura per tutti e fuori dal catalogo, ma nulla viene cancellato.'}
            </p>
          </div>
          <button className="btn" onClick={toggleArchive} disabled={hidden}>
            <Icon name="archive" size={16} /> {archived ? 'Riattiva' : 'Archivia'}
          </button>
        </div>
        <div className="danger-row is-destructive">
          <div>
            <strong><Icon name="alert" size={16} /> Elimina il progetto</strong>
            <p>Cancella per sempre il progetto e tutti i suoi contenuti. L'azione non si può annullare.</p>
          </div>
          <button className="btn btn-danger" onClick={remove}>
            <Icon name="trash" size={16} /> Elimina
          </button>
        </div>
      </section>
    </div>
  );
}
