import { Link } from 'react-router-dom';
import { dueInfo, formatDate } from '../utils';
import Avatar from './Avatar';
import { DueLabel, PriorityBadge, ProgressBar } from './Badges';
import Icon from './Icon';

// Panoramica: descrizione, avanzamento e prossime scadenze (calcolati dai task reali, aggiornati in tempo reale).
export default function OverviewTab({ project, isMember, tasks, onOpenTab }) {
  const counts = { todo: 0, in_progress: 0, done: 0, overdue: 0 };
  tasks?.forEach((t) => {
    counts[t.status] += 1;
    if (t.status !== 'done' && dueInfo(t).days !== null && dueInfo(t).days < 0) counts.overdue += 1;
  });
  const total = tasks?.length ?? 0;
  const upcoming = (tasks || [])
    .filter((t) => t.status !== 'done' && t.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  return (
    <div className="overview">
      <div className="overview-main">
        <section className="card panel" aria-labelledby="ov-about">
          <h2 id="ov-about">Il progetto</h2>
          {project.description ? <p className="prose">{project.description}</p> : <p className="muted">Nessuna descrizione.</p>}
          {project.technologies.length > 0 && (
            <ul className="chips" aria-label="Tecnologie">
              {project.technologies.map((t) => (
                <li key={t} className="chip">{t}</li>
              ))}
            </ul>
          )}
        </section>

        {isMember ? (
          <section className="card panel" aria-labelledby="ov-progress">
            <h2 id="ov-progress">Avanzamento</h2>
            <div className="mini-stats">
              <div><strong className="tabular">{counts.todo}</strong><span>Da fare</span></div>
              <div><strong className="tabular">{counts.in_progress}</strong><span>In corso</span></div>
              <div><strong className="tabular">{counts.done}</strong><span>Completati</span></div>
              <div className={counts.overdue ? 'is-danger' : ''}><strong className="tabular">{counts.overdue}</strong><span>Scaduti</span></div>
            </div>
            <ProgressBar done={counts.done} total={total} />
            <h3 className="panel-subtitle">Prossime scadenze</h3>
            {upcoming.length === 0 ? (
              <p className="muted">Nessun task aperto con una scadenza.</p>
            ) : (
              <ul className="list-plain">
                {upcoming.map((t) => (
                  <li key={t._id}>
                    <Link to={`/projects/${project._id}?tab=board&task=${t._id}`} className="upcoming">
                      <span className="truncate grow">{t.title}</span>
                      <PriorityBadge value={t.priority} />
                      <DueLabel task={t} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <button className="btn" onClick={() => onOpenTab('board')}>
              <Icon name="board" size={16} /> Apri la bacheca
            </button>
          </section>
        ) : (
          <section className="card panel" aria-labelledby="ov-join">
            <h2 id="ov-join">Vuoi partecipare?</h2>
            <p className="muted">
              Bacheca e chat sono riservate ai membri. Chiedi a <strong>{project.owner.name}</strong> di invitarti usando l'email del tuo account: riceverai una notifica e potrai accettare.
            </p>
          </section>
        )}
      </div>

      <aside className="overview-side">
        <section className="card panel" aria-labelledby="ov-info">
          <h2 id="ov-info">Informazioni</h2>
          <dl className="facts">
            <dt>Proprietario</dt>
            <dd><Avatar name={project.owner.name} size={22} /> {project.owner.name}</dd>
            <dt>Categoria</dt>
            <dd>{project.category}</dd>
            <dt>Visibilità</dt>
            <dd>{project.visibility === 'public' ? 'Pubblico' : 'Privato'}</dd>
            <dt>Creato il</dt>
            <dd>{formatDate(project.createdAt)}</dd>
            <dt>Membri</dt>
            <dd>{project.members.length + 1}</dd>
          </dl>
        </section>
      </aside>
    </div>
  );
}
