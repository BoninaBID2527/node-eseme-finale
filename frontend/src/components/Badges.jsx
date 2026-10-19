import Icon from './Icon';
import { dueInfo, priorityLabel, PROJECT_STATUS, statusLabel } from '../utils';

// La priorità è comunicata da etichetta e forma, non solo dal colore.
export function PriorityBadge({ value }) {
  return <span className={`badge badge-priority-${value}`}>{priorityLabel(value)}</span>;
}

export function StatusPill({ value }) {
  return <span className={`pill pill-${value}`}>{statusLabel(value)}</span>;
}

export function ProjectStatusBadge({ status }) {
  if (status === 'active') return null;
  return <span className={`badge badge-project-${status}`}>{PROJECT_STATUS[status]}</span>;
}

export function DueLabel({ task, withIcon = true }) {
  const { text, tone } = dueInfo(task);
  if (!task.dueDate) return null;
  return (
    <span className={`due ${tone}`}>
      {withIcon && <Icon name={tone === 'overdue' ? 'alert' : 'calendar'} size={14} />}
      {text}
    </span>
  );
}

export function VisibilityLabel({ visibility }) {
  return (
    <span className="visibility">
      <Icon name={visibility === 'public' ? 'globe' : 'lock'} size={14} />
      {visibility === 'public' ? 'Pubblico' : 'Privato'}
    </span>
  );
}

export function ProgressBar({ done, total }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="progress" role="img" aria-label={`${done} task completati su ${total}`}>
      <span className="progress-bar">
        <span style={{ width: `${percent}%` }} />
      </span>
      <small>{total ? `${done}/${total}` : 'Nessun task'}</small>
    </div>
  );
}
