import Icon from './Icon';
import { dueInfo, priorityLabel, PROJECT_STATUS, statusLabel } from '../utils';

// La priorità è comunicata da etichetta e forma, non solo dal colore.
export function PriorityBadge({ value, withIcon = false }) {
  return (
    <span className={`badge badge-priority-${value}`}>
      {withIcon && <Icon name="flag" size={12} />}
      {priorityLabel(value)}
    </span>
  );
}

export function StatusPill({ value }) {
  return <span className={`pill pill-${value}`}>{statusLabel(value)}</span>;
}

export function ProjectStatusBadge({ status }) {
  if (status === 'active') return null;
  return <span className={`badge badge-project-${status}`}>{PROJECT_STATUS[status]}</span>;
}

// chip: scadenza come etichetta colorata (rosso = scaduta, giallo = vicina), usata sulle schede della bacheca.
export function DueLabel({ task, withIcon = true, chip = false }) {
  const { text, tone } = dueInfo(task);
  if (!task.dueDate) return null;
  return (
    <span className={`due ${tone}${chip ? ' due-chip' : ''}`}>
      {withIcon && <Icon name={tone === 'overdue' ? 'alert' : 'calendar'} size={14} />}
      {text}
    </span>
  );
}

// Pallino dello stato (colonna): grigio = da fare, giallo = in corso, verde = completato.
export function StatusDot({ value }) {
  return <span className={`status-dot status-dot-${value}`} aria-hidden="true" />;
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
