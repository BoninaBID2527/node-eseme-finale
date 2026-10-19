import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useSocketEvent } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { daysUntil, formatDate, priorityLabel, STATUSES } from '../utils';
import Avatar from './Avatar';
import TaskModal from './TaskModal';

function TaskCard({ task, onOpen, onDragStart, onDragEnd, dragging, readOnly }) {
  const days = daysUntil(task.dueDate);
  const overdue = days !== null && days < 0 && task.status !== 'done';
  return (
    <article
      className={`task${dragging ? ' dragging' : ''}`}
      draggable={!readOnly}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task._id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(task._id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task)}
      data-testid="task"
    >
      <div className="task-title">{task.title}</div>
      <div className="task-meta">
        <span className={`badge badge-${task.priority}`}>{priorityLabel(task.priority)}</span>
        {task.dueDate && <span className={`due${overdue ? ' overdue' : ''}`}>{formatDate(task.dueDate)}</span>}
        <span className="spacer" />
        {task.assignee && <Avatar name={task.assignee.name} size={24} />}
      </div>
    </article>
  );
}

// Bacheca a 3 colonne con drag and drop e aggiornamenti in tempo reale.
export default function Board({ project, people, readOnly }) {
  const toast = useToast();
  const [tasks, setTasks] = useState(null);
  const [modal, setModal] = useState(null); // { task?, status? }
  const [draggingId, setDraggingId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);

  useEffect(() => {
    api
      .get(`/projects/${project._id}/tasks`)
      .then((data) => setTasks(data.tasks))
      .catch((err) => toast(err.message, 'error'));
  }, [project._id, toast]);

  // Inserisce o sostituisce un task (gli eventi live possono arrivare anche per azioni proprie).
  const upsert = useCallback(
    (task) => {
      if (task.project !== project._id) return;
      setTasks((list) => (list ? (list.some((t) => t._id === task._id) ? list.map((t) => (t._id === task._id ? task : t)) : [...list, task]) : list));
    },
    [project._id]
  );
  const remove = useCallback(
    (task) => {
      if (task.project !== project._id) return;
      setTasks((list) => list && list.filter((t) => t._id !== task._id));
    },
    [project._id]
  );

  useSocketEvent('task:created', upsert);
  useSocketEvent('task:updated', upsert);
  useSocketEvent('task:moved', upsert);
  useSocketEvent('task:deleted', remove);

  const moveTask = async (taskId, status) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.status === status) return;
    setTasks((list) => list.map((t) => (t._id === taskId ? { ...t, status } : t))); // aggiornamento immediato
    try {
      const data = await api.patch(`/projects/${project._id}/tasks/${taskId}/status`, { status });
      upsert(data.task);
    } catch (err) {
      setTasks((list) => list.map((t) => (t._id === taskId ? task : t))); // ripristina
      toast(err.message, 'error');
    }
  };

  if (!tasks) return <div className="muted">Caricamento bacheca…</div>;

  return (
    <>
      <div className="board">
        {STATUSES.map((column) => {
          const items = tasks.filter((t) => t.status === column.value);
          return (
            <section
              key={column.value}
              className={`column column-${column.value}${overColumn === column.value ? ' over' : ''}`}
              onDragOver={(e) => {
                if (readOnly) return;
                e.preventDefault();
                setOverColumn(column.value);
              }}
              onDragLeave={() => setOverColumn(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOverColumn(null);
                if (!readOnly) moveTask(e.dataTransfer.getData('text/plain'), column.value);
              }}
              data-testid={`column-${column.value}`}
            >
              <header>
                <h3>{column.label}</h3>
                <span className="count">{items.length}</span>
              </header>
              <div className="column-body">
                {items.map((task) => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    readOnly={readOnly}
                    dragging={draggingId === task._id}
                    onDragStart={setDraggingId}
                    onDragEnd={() => setDraggingId(null)}
                    onOpen={(t) => setModal({ task: t })}
                  />
                ))}
                {items.length === 0 && <p className="column-empty">Nessun task</p>}
              </div>
              {!readOnly && (
                <button className="add-task" onClick={() => setModal({ status: column.value })}>
                  + Aggiungi task
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
          onDeleted={(id) => setTasks((list) => list.filter((t) => t._id !== id))}
        />
      )}
    </>
  );
}
