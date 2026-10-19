import { useState } from 'react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { PRIORITIES, STATUSES, toDateInput } from '../utils';
import Modal from './Modal';

// Crea o modifica un task. `task` è null quando si crea.
export default function TaskModal({ projectId, task, defaultStatus = 'todo', people, readOnly, onClose, onSaved, onDeleted }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    dueDate: toDateInput(task?.dueDate),
    priority: task?.priority ?? 'medium',
    status: task?.status ?? defaultStatus,
    assignee: task?.assignee?._id ?? '',
  });
  const [saving, setSaving] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, dueDate: form.dueDate || null, assignee: form.assignee || null };
    try {
      const data = task
        ? await api.put(`/projects/${projectId}/tasks/${task._id}`, payload)
        : await api.post(`/projects/${projectId}/tasks`, payload);
      onSaved(data.task);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Eliminare questo task?')) return;
    try {
      await api.delete(`/projects/${projectId}/tasks/${task._id}`);
      onDeleted(task._id);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <Modal title={task ? 'Modifica task' : 'Nuovo task'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label>
          Titolo
          <input value={form.title} onChange={update('title')} required autoFocus disabled={readOnly} maxLength={120} />
        </label>
        <label>
          Descrizione
          <textarea rows={3} value={form.description} onChange={update('description')} disabled={readOnly} />
        </label>
        <div className="form-row">
          <label>
            Scadenza
            <input type="date" value={form.dueDate} onChange={update('dueDate')} disabled={readOnly} />
          </label>
          <label>
            Priorità
            <select value={form.priority} onChange={update('priority')} disabled={readOnly}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Stato
            <select value={form.status} onChange={update('status')} disabled={readOnly}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assegnato a
            <select value={form.assignee} onChange={update('assignee')} disabled={readOnly}>
              <option value="">Nessuno</option>
              {people.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!readOnly && (
          <div className="modal-actions">
            {task && (
              <button type="button" className="btn btn-danger-ghost" onClick={remove}>
                Elimina
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose}>
              Annulla
            </button>
            <button className="btn btn-primary" disabled={saving}>
              {task ? 'Salva' : 'Crea task'}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
