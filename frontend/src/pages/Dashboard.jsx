import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { DueLabel, PriorityBadge } from '../components/Badges';
import Icon from '../components/Icon';
import InvitationList from '../components/InvitationList';
import ProjectCard from '../components/ProjectCard';
import { Skeleton, RowsSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/StateMessage';
import { useAuth } from '../context/AuthContext';
import { useRealtime, useSocketEvent } from '../context/RealtimeContext';
import useAsync from '../hooks/useAsync';
import useDocumentTitle from '../hooks/useDocumentTitle';

const todayLabel = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

function TaskRow({ task, overdue }) {
  return (
    <Link to={`/projects/${task.project._id}?tab=board&task=${task._id}`} className={`list-row${overdue ? ' is-overdue' : ''}`}>
      <div className="grow">
        <strong className="truncate">{task.title}</strong>
        <small className="muted truncate">{task.project.title}</small>
      </div>
      <PriorityBadge value={task.priority} />
      <DueLabel task={task} />
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
  const statCards = stats && [
    { label: 'Task da completare', value: stats.openTasks, to: '/tasks' },
    { label: 'Task scaduti', value: stats.overdue, to: '/tasks?due=overdue', tone: stats.overdue > 0 ? 'danger' : '' },
    { label: 'In scadenza (7 giorni)', value: stats.dueThisWeek, to: '/tasks?due=week' },
    { label: 'Progetti', value: stats.created + stats.memberOf, to: '/projects', sub: `${stats.created} creati · ${stats.memberOf} da membro` },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1 className="page-title">Ciao, {user.name.split(' ')[0]}</h1>
          <p className="page-lead">{stats ? leadText(stats) : ' '}</p>
        </div>
        <div className="page-actions">
          <Link to="/catalog" className="btn">
            <Icon name="compass" size={18} /> Esplora il catalogo
          </Link>
          <button className="btn btn-primary" onClick={() => navigate('/projects/new')}>
            <Icon name="plus" size={18} /> Nuovo progetto
          </button>
        </div>
      </header>

      <div className="stats">
        {loading && !data
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="card stat">
                <Skeleton width={60} height={36} />
                <Skeleton width="70%" height={14} />
              </div>
            ))
          : statCards.map((s) => (
              <Link key={s.label} to={s.to} className={`card stat${s.tone ? ` stat-${s.tone}` : ''}`}>
                <strong className="stat-value">{s.value}</strong>
                <span>{s.label}</span>
                {s.sub && <small>{s.sub}</small>}
              </Link>
            ))}
      </div>

      {data?.invitations.length > 0 && (
        <section className="section" aria-labelledby="dash-invites">
          <div className="section-head">
            <h2 id="dash-invites">Inviti in sospeso</h2>
          </div>
          <div className="card">
            <InvitationList invitations={data.invitations} onChanged={() => reload({ silent: true })} />
          </div>
        </section>
      )}

      <div className="split">
        <section className="section" aria-labelledby="dash-due">
          <div className="section-head">
            <h2 id="dash-due">Da fare ora</h2>
            <Link to="/tasks">Tutti i miei task</Link>
          </div>
          {loading && !data ? (
            <RowsSkeleton rows={4} />
          ) : data.overdue.length + data.upcoming.length === 0 ? (
            <EmptyState
              icon="check-circle"
              title="Niente in scadenza"
              text="Non ci sono task scaduti o con una scadenza vicina assegnati a te."
              action={<Link className="btn" to="/tasks?status=all">Vedi tutti i task</Link>}
            />
          ) : (
            <div className="card list" data-testid="due-tasks">
              {data.overdue.map((t) => (
                <TaskRow key={t._id} task={t} overdue />
              ))}
              {data.upcoming.map((t) => (
                <TaskRow key={t._id} task={t} />
              ))}
            </div>
          )}
        </section>

        <section className="section" aria-labelledby="dash-quick">
          <div className="section-head">
            <h2 id="dash-quick">Azioni rapide</h2>
          </div>
          <div className="card quick">
            <Link to="/projects/new" className="quick-item">
              <Icon name="plus" size={18} /> Crea un nuovo progetto
              <Icon name="arrow-right" size={16} className="quick-arrow" />
            </Link>
            <Link to="/catalog" className="quick-item">
              <Icon name="compass" size={18} /> Cerca un progetto a cui unirti
              <Icon name="arrow-right" size={16} className="quick-arrow" />
            </Link>
            <Link to="/notifications" className="quick-item">
              <Icon name="bell" size={18} /> Leggi le notifiche
              <Icon name="arrow-right" size={16} className="quick-arrow" />
            </Link>
            <Link to="/profile" className="quick-item">
              <Icon name="user" size={18} /> Modifica il profilo
              <Icon name="arrow-right" size={16} className="quick-arrow" />
            </Link>
          </div>
        </section>
      </div>

      <section className="section" aria-labelledby="dash-projects">
        <div className="section-head">
          <h2 id="dash-projects">Progetti recenti</h2>
          <Link to="/projects">Tutti i miei progetti</Link>
        </div>
        {data && data.recentProjects.length === 0 ? (
          <EmptyState
            icon="folder"
            title="Non fai ancora parte di nessun progetto"
            text="Crea il tuo primo progetto oppure cerca nel catalogo un team a cui unirti."
            action={<Link className="btn btn-primary" to="/projects/new">Crea un progetto</Link>}
          />
        ) : (
          <div className="grid">
            {data?.recentProjects.map((p) => (
              <ProjectCard key={p._id} project={p} showProgress />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
