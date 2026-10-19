import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import ProjectCard from '../components/ProjectCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { daysUntil, formatDate, priorityLabel, STATUSES } from '../utils';

function dueText(task) {
  const days = daysUntil(task.dueDate);
  if (days === null) return { text: 'Nessuna scadenza', tone: '' };
  if (task.status === 'done') return { text: formatDate(task.dueDate), tone: '' };
  if (days < 0) return { text: `Scaduto da ${-days} g`, tone: 'overdue' };
  if (days === 0) return { text: 'Scade oggi', tone: 'soon' };
  if (days <= 3) return { text: `Scade tra ${days} g`, tone: 'soon' };
  return { text: formatDate(task.dueDate), tone: '' };
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then(setData).catch((err) => toast(err.message, 'error'));
  }, [toast]);

  if (!data) return <div className="page muted">Caricamento…</div>;

  const openTasks = data.tasks.filter((t) => t.status !== 'done').length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Ciao, {user.name.split(' ')[0]} 👋</h1>
          <p className="muted">Ecco cosa succede nei tuoi progetti.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/projects/new')}>
          + Nuovo progetto
        </button>
      </header>

      <div className="stats">
        <div className="card stat">
          <strong>{data.created.length}</strong>
          <span>Progetti creati</span>
        </div>
        <div className="card stat">
          <strong>{data.memberOf.length}</strong>
          <span>Progetti da membro</span>
        </div>
        <div className="card stat">
          <strong>{openTasks}</strong>
          <span>Task da completare</span>
        </div>
      </div>

      <section className="section">
        <h2>I miei task</h2>
        {data.tasks.length === 0 ? (
          <div className="empty card">
            <p className="muted">Nessun task assegnato a te.</p>
          </div>
        ) : (
          <div className="card list" data-testid="my-tasks">
            {data.tasks.map((task) => {
              const due = dueText(task);
              return (
                <Link key={task._id} to={`/projects/${task.project._id}`} className="list-row">
                  <div className="grow">
                    <strong>{task.title}</strong>
                    <small className="muted">{task.project.title}</small>
                  </div>
                  <span className={`badge badge-${task.priority}`}>{priorityLabel(task.priority)}</span>
                  <span className={`status-pill status-${task.status}`}>{STATUSES.find((s) => s.value === task.status).label}</span>
                  <span className={`due ${due.tone}`}>{due.text}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="section">
        <h2>Progetti creati da me</h2>
        {data.created.length === 0 ? (
          <div className="empty card">
            <p className="muted">Non hai ancora creato progetti.</p>
          </div>
        ) : (
          <div className="grid">
            {data.created.map((p) => (
              <ProjectCard key={p._id} project={p} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>Progetti di cui sono membro</h2>
        {data.memberOf.length === 0 ? (
          <div className="empty card">
            <p className="muted">Nessuno ti ha ancora invitato in un progetto.</p>
          </div>
        ) : (
          <div className="grid">
            {data.memberOf.map((p) => (
              <ProjectCard key={p._id} project={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
