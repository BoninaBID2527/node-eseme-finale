import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { dueInfo, errorMessage, statusLabel, STATUSES } from '../utils';
import Avatar from './Avatar';
import { DueLabel, PriorityBadge } from './Badges';
import DropdownMenu from './DropdownMenu';
import Icon from './Icon';
import { ErrorState } from './StateMessage';
import TaskModal from './TaskModal';

const NEXT = { ArrowRight: 1, ArrowLeft: -1 };

function TaskCard({ task, me, readOnly, dragging, onOpen, onMove, onAssignMe, onDelete, onDragStart, onDragEnd }) {
  const isMine = task.assignee?._id === me;

  const onKeyDown = (e) => {
    // Tastiera: Maiusc + freccia destra/sinistra sposta il task nella colonna accanto.
    if (readOnly || !e.shiftKey || !NEXT[e.key]) return;
    const index = STATUSES.findIndex((s) => s.value === task.status);
    const target = STATUSES[index + NEXT[e.key]];
    if (target) {
      e.preventDefault();
      onMove(task, target.value);
    }
  };

  const items = [
    { label: readOnly ? 'Apri dettaglio' : 'Modifica', icon: 'edit', onSelect: () => onOpen(task) },
    ...(readOnly
      ? []
      : [
          { heading: 'Sposta in' },
          ...STATUSES.map((s) => ({ label: s.label, checked: task.status === s.value, onSelect: () => onMove(task, s.value) })),
          { heading: 'Assegnazione' },
          { label: isMine ? 'Già assegnato a te' : 'Assegna a me', icon: 'user', disabled: isMine, onSelect: () => onAssignMe(task) },
          { heading: 'Altro' },
          { label: 'Elimina', icon: 'trash', danger: true, onSelect: () => onDelete(task) },
        ]),
  ];

  return (
    <li
      className={`task${dragging ? ' is-dragging' : ''}${task.status === 'done' ? ' is-done' : ''}`}
      draggable={!readOnly}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task._id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(task._id);
      }}
      onDragEnd={onDragEnd}
      data-testid="task"
      data-task-id={task._id}
    >
      <button className="task-main" onClick={() => onOpen(task)} onKeyDown={onKeyDown} aria-label={`${task.title}. ${statusLabel(task.status)}${task.assignee ? `, assegnato a ${task.assignee.name}` : ''}. ${readOnly ? '' : 'Maiusc e frecce per spostare.'}`}>
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          <PriorityBadge value={task.priority} />
          <DueLabel task={task} />
          <span className="spacer" />
          {task.assignee ? <Avatar name={task.assignee.name} size={24} /> : <span className="task-unassigned" title="Nessun assegnatario"><Icon name="user" size={14} /></span>}
        </span>
      </button>
      <DropdownMenu label={`Azioni per il task "${task.title}"`} items={items} triggerClassName="icon-btn task-menu" />
    </li>
  );
}

// Bacheca a 3 colonne. Spostare un task: trascinamento con il mouse, menu "Sposta in" (touch e tastiera)
// oppure Maiusc + frecce sulla scheda. In caso di errore lo stato torna quello corretto.
export default function Board({ project, people, readOnly, tasksApi, openTaskId, onTaskOpened }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { tasks, error, reload, upsert, remove, patch } = tasksApi;
  const [modal, setModal] = useState(null); // { task } oppure { status }
  const [draggingId, setDraggingId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);
  const [announce, setAnnounce] = useState('');
  const [filters, setFilters] = useState({ q: '', assignee: '', priority: '', due: '' });

  // Link diretto a un task (da notifiche e dashboard): apre il dettaglio appena i task sono caricati.
  useEffect(() => {
    if (!openTaskId || !tasks) return;
    const task = tasks.find((t) => t._id === openTaskId);
    if (task) setModal({ task });
    onTaskOpened?.();
  }, [openTaskId, tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!tasks) return [];
    const q = filters.q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      if (filters.assignee === 'me' && t.assignee?._id !== user._id) return false;
      if (filters.assignee === 'none' && t.assignee) return false;
      if (filters.assignee && !['me', 'none'].includes(filters.assignee) && t.assignee?._id !== filters.assignee) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      const { days } = dueInfo(t);
      if (filters.due === 'overdue' && !(days !== null && days < 0 && t.status !== 'done')) return false;
      if (filters.due === 'week' && !(days !== null && days >= 0 && days <= 7)) return false;
      if (filters.due === 'none' && days !== null) return false;
      return true;
    });
  }, [tasks, filters, user._id]);

  const hasFilters = Object.values(filters).some(Boolean);
  const setFilter = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });

  const moveTask = async (task, status) => {
    if (task.status === status) return;
    const previous = task.status;
    patch(task._id, { status }); // l'interfaccia risponde subito
    try {
      const data = await api.patch(`/projects/${project._id}/tasks/${task._id}/status`, { status });
      upsert(data.task);
      setAnnounce(`"${task.title}" spostato in ${statusLabel(status)}`);
    } catch (err) {
      patch(task._id, { status: previous }); // ripristina lo stato corretto
      toast(`Spostamento non riuscito: ${errorMessage(err)}`, 'error');
      setAnnounce('Spostamento non riuscito');
    }
  };

  const assignMe = async (task) => {
    try {
      const data = await api.patch(`/projects/${project._id}/tasks/${task._id}/assignee`, { assignee: user._id });
      upsert(data.task);
      toast('Task assegnato a te', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const deleteTask = async (task) => {
    const ok = await confirm({
      title: 'Eliminare il task?',
      message: `"${task.title}" verrà eliminato per tutti i membri del progetto.`,
      confirmLabel: 'Elimina task',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/projects/${project._id}/tasks/${task._id}`);
      remove(task);
      toast('Task eliminato', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  if (error && !tasks) return <ErrorState message={error} onRetry={reload} />;
  if (!tasks) {
    return (
      <div className="board" aria-busy="true">
        {STATUSES.map((c) => (
          <section key={c.value} className="column"><div className="skeleton" style={{ height: 120, borderRadius: 10 }} /></section>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="board-toolbar" role="search" aria-label="Filtra i task della bacheca">
        <div className="search board-search">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Cerca un task" aria-label="Cerca un task" value={filters.q} onChange={setFilter('q')} />
        </div>
        <select aria-label="Filtra per assegnatario" value={filters.assignee} onChange={setFilter('assignee')}>
          <option value="">Assegnatario</option>
          <option value="me">Assegnati a me</option>
          <option value="none">Non assegnati</option>
          {people.filter((p) => p._id !== user._id).map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>
        <select aria-label="Filtra per priorità" value={filters.priority} onChange={setFilter('priority')}>
          <option value="">Priorità</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Bassa</option>
        </select>
        <select aria-label="Filtra per scadenza" value={filters.due} onChange={setFilter('due')}>
          <option value="">Scadenza</option>
          <option value="overdue">Scaduti</option>
          <option value="week">Prossimi 7 giorni</option>
          <option value="none">Senza scadenza</option>
        </select>
        {hasFilters && (
          <button className="btn btn-sm" onClick={() => setFilters({ q: '', assignee: '', priority: '', due: '' })}>
            <Icon name="x" size={14} /> Azzera
          </button>
        )}
        {!readOnly && (
          <button className="btn btn-primary btn-sm board-add" onClick={() => setModal({ status: 'todo' })}>
            <Icon name="plus" size={16} /> Nuovo task
          </button>
        )}
      </div>
      {hasFilters && (
        <p className="muted results-count" role="status">
          {filtered.length} di {tasks.length} task
        </p>
      )}
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>

      {tasks.length === 0 && !readOnly && (
        <div className="board-hint">
          <Icon name="board" size={20} />
          <p>La bacheca è vuota: crea il primo task e assegnalo a un membro del progetto.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({ status: 'todo' })}>Crea il primo task</button>
        </div>
      )}
        <div className="board">
          {STATUSES.map((column) => {
            const items = filtered.filter((t) => t.status === column.value);
            const total = tasks.filter((t) => t.status === column.value).length;
            return (
              <section
                key={column.value}
                className={`column column-${column.value}${overColumn === column.value ? ' is-over' : ''}`}
                aria-labelledby={`col-${column.value}`}
                onDragOver={(e) => {
                  if (readOnly) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (overColumn !== column.value) setOverColumn(column.value);
                }}
                onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setOverColumn(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverColumn(null);
                  const task = tasks.find((t) => t._id === e.dataTransfer.getData('text/plain'));
                  if (task && !readOnly) moveTask(task, column.value);
                }}
                data-testid={`column-${column.value}`}
              >
                <header className="column-head">
                  <h3 id={`col-${column.value}`}>{column.label}</h3>
                  <span className="count">{hasFilters ? `${items.length}/${total}` : total}</span>
                </header>
                <ul className="column-body">
                  {items.map((task) => (
                    <TaskCard
                      key={task._id}
                      task={task}
                      me={user._id}
                      readOnly={readOnly}
                      dragging={draggingId === task._id}
                      onOpen={(t) => setModal({ task: t })}
                      onMove={moveTask}
                      onAssignMe={assignMe}
                      onDelete={deleteTask}
                      onDragStart={setDraggingId}
                      onDragEnd={() => { setDraggingId(null); setOverColumn(null); }}
                    />
                  ))}
                </ul>
                {items.length === 0 && <p className="column-empty">{hasFilters && total > 0 ? 'Nessun task corrisponde ai filtri' : 'Nessun task'}</p>}
                {overColumn === column.value && <p className="column-drop" aria-hidden="true">Rilascia qui per spostare</p>}
                {!readOnly && (
                  <button className="add-task" onClick={() => setModal({ status: column.value })}>
                    <Icon name="plus" size={16} /> Aggiungi task
                  </button>
                )}
              </section>
            );
          })}
        </div>

      {modal && (
        <TaskModal
          projectId={project._id}
          task={modal.task}
          defaultStatus={modal.status}
          people={people}
          readOnly={readOnly}
          onClose={() => setModal(null)}
          onSaved={upsert}
          onDeleted={(id) => remove({ _id: id, project: project._id })}
        />
      )}
    </>
  );
}
