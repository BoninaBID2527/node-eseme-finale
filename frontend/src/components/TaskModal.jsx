import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { errorMessage, formatDate, PRIORITIES, STATUSES, toDateInput } from '../utils';
import { DueLabel, PriorityBadge, StatusPill } from './Badges';
import Field from './Field';
import Icon from './Icon';
import Modal from './Modal';
import TaskComments from './TaskComments';

// Dettaglio di un task: creazione, modifica, riassegnazione ed eliminazione. In sola lettura se il progetto non è modificabile.
export default function TaskModal({ projectId, task, defaultStatus = 'todo', people, knownLabels = [], canModerate = false, readOnly, onClose, onSaved, onDeleted }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    dueDate: toDateInput(task?.dueDate),
    priority: task?.priority ?? 'medium',
    status: task?.status ?? defaultStatus,
    assignee: task?.assignee?._id ?? '',
    labels: task?.labels?.join(', ') ?? '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const formId = useId();
  const alertRef = useRef(null);

  // Un errore importante resta visibile nel pannello: lo si porta in vista invece di affidarlo a un toast.
  useEffect(() => {
    if (formError || Object.keys(errors).length) alertRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [formError, errors]);

  const update = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError('');
    const payload = { ...form, dueDate: form.dueDate || null, assignee: form.assignee || null, labels: form.labels };
    try {
      const data = task ? await api.put(`/projects/${projectId}/tasks/${task._id}`, payload) : await api.post(`/projects/${projectId}/tasks`, payload);
      onSaved(data.task);
      toast(task ? 'Task aggiornato' : 'Task creato', 'success');
      onClose();
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      else setFormError(errorMessage(err));
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Eliminare il task?',
      message: `"${task.title}" verrà eliminato per tutti i membri del progetto. L'azione non si può annullare.`,
      confirmLabel: 'Elimina task',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/projects/${projectId}/tasks/${task._id}`);
      onDeleted(task._id);
      toast('Task eliminato', 'success');
      onClose();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const isEdit = Boolean(task);

  return (
    <Modal title={readOnly ? 'Dettaglio task' : task ? 'Modifica task' : 'Nuovo task'} onClose={onClose} size={isEdit ? 'drawer' : 'md'}>
      {isEdit && (
        <div className="task-summary" aria-label="Riepilogo del task">
          <StatusPill value={task.status} />
          <PriorityBadge value={task.priority} withIcon />
          <DueLabel task={task} chip />
          <span className="spacer" />
          <span className="meta task-created">
            Creato il {formatDate(task.createdAt)}
            {task.updatedAt !== task.createdAt && ` · modificato il ${formatDate(task.updatedAt)}`}
          </span>
        </div>
      )}

      <form id={formId} onSubmit={submit} className="form task-form" noValidate>
        {formError && <p className="form-alert" role="alert" ref={alertRef}>{formError}</p>}
        <fieldset className="form" disabled={readOnly}>
          <Field label="Titolo" error={errors.title}>
            <input className="task-title-input" value={form.title} onChange={update('title')} required maxLength={120} data-autofocus />
          </Field>

          <div className="task-props">
            <Field label="Stato" error={errors.status}>
              <select value={form.status} onChange={update('status')}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Priorità" error={errors.priority}>
              <select value={form.priority} onChange={update('priority')}>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Assegnato a" error={errors.assignee}>
              <select value={form.assignee} onChange={update('assignee')}>
                <option value="">Nessuno</option>
                {people.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                    {p._id === user._id ? ' (tu)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Scadenza" error={errors.dueDate} optional>
              <input type="date" value={form.dueDate} onChange={update('dueDate')} />
            </Field>
          </div>

          <Field label="Descrizione" error={errors.description} optional>
            <textarea rows={isEdit ? 4 : 3} value={form.description} onChange={update('description')} maxLength={2000} />
          </Field>
          <Field label="Etichette" error={errors.labels} optional hint="Separate da virgola (max 5), per esempio: bug, frontend">
            <input value={form.labels} onChange={update('labels')} list="known-labels" maxLength={120} />
          </Field>
          <datalist id="known-labels">
            {knownLabels.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </fieldset>

        {!isEdit && (
          <div className="modal-actions">
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose}>Annulla</button>
            <button className={`btn btn-primary${saving ? ' is-loading' : ''}`} disabled={saving}>Crea task</button>
          </div>
        )}
      </form>

      {isEdit && <TaskComments projectId={projectId} taskId={task._id} readOnly={readOnly} canModerate={canModerate} />}

      {isEdit && !readOnly && (
        <section className="task-danger" aria-labelledby={`${formId}-danger`}>
          <div>
            <h3 id={`${formId}-danger`}>Zona pericolosa</h3>
            <p className="meta">Elimina il task e i suoi commenti per tutti i membri. L'azione non si può annullare.</p>
          </div>
          <button type="button" className="btn btn-danger-ghost" onClick={remove}>
            <Icon name="trash" size={16} /> Elimina task
          </button>
        </section>
      )}

      {isEdit && (
        <div className="modal-actions drawer-actions">
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            {readOnly ? 'Chiudi' : 'Annulla'}
          </button>
          {!readOnly && (
            <button form={formId} className={`btn btn-primary${saving ? ' is-loading' : ''}`} disabled={saving}>
              Salva
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
