import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { DueLabel, PriorityBadge } from '../components/Badges';
import Icon from '../components/Icon';
import InvitationList from '../components/InvitationList';
import PageHeader from '../components/PageHeader';
import { Skeleton, RowsSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/StateMessage';
import { useAuth } from '../context/AuthContext';
import { useRealtime, useSocketEvent } from '../context/RealtimeContext';
import useAsync from '../hooks/useAsync';
import useDocumentTitle from '../hooks/useDocumentTitle';

const todayLabel = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

// Riga di un task assegnato: titolo e progetto a sinistra; priorità e scadenza a destra (due informazioni distinte).
function TaskRow({ task, overdue }) {
  return (
    <Link to={`/projects/${task.project._id}?tab=board&task=${task._id}`} className={`list-row dash-task${overdue ? ' is-overdue' : ''}`} data-priority={task.priority}>
      <div className="grow">
        <strong className="truncate">{task.title}</strong>
        <small className="muted truncate dash-task-project">
          <Icon name="folder" size={13} /> {task.project.title}
        </small>
      </div>
      <div className="dash-task-meta">
        <DueLabel task={task} />
        <PriorityBadge value={task.priority} />
      </div>
    </Link>
  );
}

// Riga compatta di un progetto recente: ruolo, titolo e avanzamento.
function ProjectRow({ project, userId }) {
  const owner = String(project.owner?._id || project.owner) === String(userId);
  const { done = 0, total = 0 } = project.progress || {};
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <Link to={`/projects/${project._id}`} className="list-row dash-project">
      <div className="grow">
        <strong className="truncate">{project.title}</strong>
        <span className="dash-project-sub">
          <span className={`role-tag${owner ? ' is-owner' : ''}`}>{owner ? 'Proprietario' : 'Membro'}</span>
          {project.status !== 'active' && <span className="muted">{project.status === 'archived' ? 'Archiviato' : 'Oscurato'}</span>}
          <span className="muted tabular">{total ? `${done}/${total} task` : 'Nessun task'}</span>
        </span>
        <span className="progress-bar" role="img" aria-label={`${percent}% completato`}>
          <span style={{ width: `${percent}%` }} />
        </span>
      </div>
      <Icon name="arrow-right" size={16} className="row-arrow" />
    </Link>
  );
}

function leadText(stats) {
  if (stats.overdue > 0) return `Hai ${stats.overdue} ${stats.overdue === 1 ? 'task scaduto' : 'task scaduti'}: conviene partire da lì.`;
  if (stats.dueThisWeek > 0) return `${stats.dueThisWeek} ${stats.dueThisWeek === 1 ? 'task scade' : 'task scadono'} nei prossimi 7 giorni.`;
  if (stats.openTasks > 0) return `Hai ${stats.openTasks} task aperti, nessuno in scadenza a breve.`;
  return 'Non hai task da completare. Buon lavoro!';
}

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { resyncKey } = useRealtime();
  const { data, loading, error, reload } = useAsync(() => api.get('/dashboard'), [resyncKey]);

  // Nuove notifiche (task assegnati, inviti...) cambiano i numeri: aggiorna senza mostrare il caricamento.
  useSocketEvent('notification:new', useCallback(() => reload({ silent: true }), [reload]));

  if (error) return <div className="page"><ErrorState message={error} onRetry={reload} /></div>;

  const stats = data?.stats;
  const items = stats && [
    { label: 'Task da completare', value: stats.openTasks, to: '/tasks' },
    { label: 'Scaduti', value: stats.overdue, to: '/tasks?due=overdue', tone: stats.overdue > 0 ? 'danger' : '' },
    { label: 'In scadenza (7 giorni)', value: stats.dueThisWeek, to: '/tasks?due=week', tone: stats.dueThisWeek > 0 ? 'warn' : '' },
    { label: 'Progetti', value: stats.created + stats.memberOf, to: '/projects', sub: `${stats.created} creati · ${stats.memberOf} da membro` },
  ];
  const hasTasks = data && data.overdue.length + data.upcoming.length > 0;

  return (
    <div className="page">
      <PageHeader
        eyebrow={todayLabel}
        title={`Ciao, ${user.name.split(' ')[0]}`}
        lead={stats ? leadText(stats) : ' '}
        actions={
          <>
            <Link to="/catalog" className="btn">
              <Icon name="compass" size={18} /> Esplora il catalogo
            </Link>
            <button className="btn btn-primary" onClick={() => navigate('/projects/new')}>
              <Icon name="plus" size={18} /> Nuovo progetto
            </button>
          </>
        }
      />

      {data?.invitations.length > 0 && (
        <section className="dash-invites" aria-labelledby="dash-invites">
          <div className="section-head">
            <h2 id="dash-invites">
              Inviti in sospeso <span className="tab-count">{data.invitations.length}</span>
            </h2>
          </div>
          <div className="card">
            <InvitationList invitations={data.invitations} onChanged={() => reload({ silent: true })} />
          </div>
        </section>
      )}

      <div className="summary card" aria-label="Riepilogo">
        {loading && !data
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="stat">
                <Skeleton width={56} height={34} />
                <Skeleton width="70%" height={14} />
              </div>
            ))
          : items.map((s) => (
              <Link key={s.label} to={s.to} className={`stat${s.tone ? ` stat-${s.tone}` : ''}`}>
                <strong className="stat-value">{s.value}</strong>
                <span className="stat-label">{s.label}</span>
                {s.sub && <small>{s.sub}</small>}
              </Link>
            ))}
      </div>

      <div className="dash-grid">
        <section className="dash-main" aria-labelledby="dash-due">
          <div className="section-head">
            <h2 id="dash-due">Da fare ora</h2>
            <Link to="/tasks">Tutti i miei task</Link>
          </div>
          {loading && !data ? (
            <RowsSkeleton rows={4} />
          ) : !hasTasks ? (
            <EmptyState
              icon="check-circle"
              title="Niente in scadenza"
              text="Non ci sono task scaduti o con una scadenza vicina assegnati a te."
              action={<Link className="btn" to="/tasks?status=all">Vedi tutti i task</Link>}
            />
          ) : (
            <div className="card list stagger" data-testid="due-tasks">
              {data.overdue.length > 0 && <p className="list-group is-overdue">In ritardo · {data.overdue.length}</p>}
              {data.overdue.map((t) => (
                <TaskRow key={t._id} task={t} overdue />
              ))}
              {data.upcoming.length > 0 && <p className="list-group">In arrivo · {data.upcoming.length}</p>}
              {data.upcoming.map((t) => (
                <TaskRow key={t._id} task={t} />
              ))}
            </div>
          )}
        </section>

        <section className="dash-side" aria-labelledby="dash-projects">
          <div className="section-head">
            <h2 id="dash-projects">Progetti recenti</h2>
            <Link to="/projects">Tutti</Link>
          </div>
          {loading && !data ? (
            <RowsSkeleton rows={4} />
          ) : data.recentProjects.length === 0 ? (
            <EmptyState
              icon="folder"
              title="Nessun progetto"
              text="Crea il tuo primo progetto oppure cerca nel catalogo un team a cui unirti."
              action={
                <div className="state-actions">
                  <Link className="btn btn-primary" to="/projects/new">Crea un progetto</Link>
                  <Link className="btn" to="/catalog">Sfoglia il catalogo</Link>
                </div>
              }
            />
          ) : (
            <div className="card list stagger">
              {data.recentProjects.map((p) => (
                <ProjectRow key={p._id} project={p} userId={user._id || user.id} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
