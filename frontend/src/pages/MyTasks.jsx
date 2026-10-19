import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, toQuery } from '../api';
import { DueLabel, PriorityBadge, StatusPill } from '../components/Badges';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { RowsSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/StateMessage';
import { useRealtime, useSocketEvent } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import useAsync from '../hooks/useAsync';
import useDebouncedValue from '../hooks/useDebouncedValue';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useUrlFilters from '../hooks/useUrlFilters';
import { daysUntil, errorMessage } from '../utils';

const DEFAULTS = { status: 'open', due: 'all', q: '', page: '1' };
const STATUS_OPTIONS = [
  { value: 'open', label: 'Da completare' },
  { value: 'todo', label: 'Da fare' },
  { value: 'in_progress', label: 'In corso' },
  { value: 'done', label: 'Completati' },
  { value: 'all', label: 'Tutti' },
];

// Raggruppa i task (già ordinati per scadenza dal server) in sezioni leggibili.
function groupTasks(tasks) {
  const groups = [
    { key: 'overdue', title: 'Scaduti', tasks: [] },
    { key: 'week', title: 'Nei prossimi 7 giorni', tasks: [] },
    { key: 'later', title: 'Più avanti', tasks: [] },
    { key: 'none', title: 'Senza scadenza', tasks: [] },
  ];
  tasks.forEach((t) => {
    const days = daysUntil(t.dueDate);
    const open = t.status !== 'done';
    if (days === null) groups[3].tasks.push(t);
    else if (days < 0 && open) groups[0].tasks.push(t);
    else if (days <= 7) groups[1].tasks.push(t);
    else groups[2].tasks.push(t);
  });
  return groups.filter((g) => g.tasks.length);
}

export default function MyTasks() {
  useDocumentTitle('I miei task');
  const toast = useToast();
  const { resyncKey } = useRealtime();
  const { filters, setFilter, reset, active } = useUrlFilters(DEFAULTS);
  const [busyId, setBusyId] = useState(null);

  const [text, setText] = useState(filters.q);
  const debounced = useDebouncedValue(text, 300);
  useEffect(() => {
    if (debounced !== filters.q) setFilter('q', debounced);
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = toQuery({ ...filters, page: filters.page === '1' ? '' : filters.page, limit: 20 });
  const { data, loading, error, reload } = useAsync(() => api.get(`/tasks/mine${query}`), [query, resyncKey]);
  useSocketEvent('notification:new', useCallback(() => reload({ silent: true }), [reload]));

  const groups = useMemo(() => (data ? groupTasks(data.tasks) : []), [data]);

  // Completa o riapre un task direttamente dall'elenco.
  const toggleDone = async (task) => {
    setBusyId(task._id);
    try {
      await api.patch(`/projects/${task.project._id}/tasks/${task._id}/status`, { status: task.status === 'done' ? 'todo' : 'done' });
      toast(task.status === 'done' ? 'Task riaperto' : 'Task completato', 'success');
      await reload({ silent: true });
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Lavoro" title="I miei task" lead="Tutti i task assegnati a te, in ordine di scadenza, su ogni progetto." />

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filtra per stato">
          {STATUS_OPTIONS.map((s) => (
            <button key={s.value} aria-pressed={filters.status === s.value} onClick={() => setFilter('status', s.value)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="field toolbar-field">
          <label htmlFor="mt-due" className="visually-hidden">Scadenza</label>
          <select id="mt-due" value={filters.due} onChange={(e) => setFilter('due', e.target.value)}>
            <option value="all">Ogni scadenza</option>
            <option value="overdue">Scaduti</option>
            <option value="week">Prossimi 7 giorni</option>
            <option value="none">Senza scadenza</option>
          </select>
        </div>
        <div className="search toolbar-search">
          <Icon name="search" size={18} />
          <input type="search" aria-label="Cerca per titolo" placeholder="Cerca per titolo" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        {active > 0 && (
          <button className="btn btn-sm" onClick={() => { reset(); setText(''); }}>
            <Icon name="x" size={14} /> Azzera
          </button>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {!error && !data && loading && <RowsSkeleton rows={5} />}
      {!error && data && data.tasks.length === 0 && (
        <EmptyState
          icon="check-circle"
          title={active > 0 ? 'Nessun task corrisponde ai filtri' : 'Nessun task da completare'}
          text={active > 0 ? 'Prova a cambiare i filtri.' : 'Quando qualcuno ti assegna un task lo trovi qui.'}
          action={
            active > 0 ? <button className="btn" onClick={() => { reset(); setText(''); }}>Azzera i filtri</button> : <Link className="btn" to="/projects">Vai ai miei progetti</Link>
          }
        />
      )}

      {!error && data && data.tasks.length > 0 && (
        <div aria-busy={loading} style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 150ms' }}>
          <p className="results-count" aria-live="polite" role="status">
            <strong className="tabular">{data.total}</strong> task
            {active > 0 && ' con i filtri scelti'}
          </p>
          {groups.map((group) => (
            <section key={group.key} className="task-group" aria-labelledby={`g-${group.key}`}>
              <h2 id={`g-${group.key}`} className={`task-group-title ${group.key === 'overdue' ? 'is-overdue' : ''}`}>
                {group.key === 'overdue' && <Icon name="alert" size={18} />}
                {group.title} <span className="tab-count">{group.tasks.length}</span>
              </h2>
              <ul className="card list stagger" data-testid={`tasks-${group.key}`}>
                {group.tasks.map((task) => (
                  <li key={task._id} className="list-row task-row" data-priority={task.priority}>
                    <button
                      className={`check${task.status === 'done' ? ' is-done' : ''}`}
                      onClick={() => toggleDone(task)}
                      disabled={busyId === task._id || task.project.status !== 'active'}
                      aria-label={task.status === 'done' ? `Riapri "${task.title}"` : `Segna come completato "${task.title}"`}
                      title={task.project.status !== 'active' ? 'Il progetto non è modificabile' : undefined}
                    >
                      <Icon name="check" size={16} />
                    </button>
                    <Link to={`/projects/${task.project._id}?tab=board&task=${task._id}`} className="task-row-main">
                      <strong className={task.status === 'done' ? 'is-done' : ''}>{task.title}</strong>
                      <small className="muted task-row-sub">
                        <Icon name="folder" size={13} /> {task.project.title}
                        {task.labels?.length > 0 && <span> · {task.labels.map((l) => `#${l}`).join(' ')}</span>}
                      </small>
                    </Link>
                    <div className="task-row-meta">
                      <DueLabel task={task} />
                      <PriorityBadge value={task.priority} />
                      <StatusPill value={task.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <Pagination page={data.page} pages={data.pages} onChange={(p) => setFilter('page', String(p))} />
        </div>
      )}
    </div>
  );
}
