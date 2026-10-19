export const STATUSES = [
  { value: 'todo', label: 'Da fare' },
  { value: 'in_progress', label: 'In corso' },
  { value: 'done', label: 'Completato' },
];

export const PRIORITIES = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Bassa' },
];

export const statusLabel = (value) => STATUSES.find((s) => s.value === value)?.label ?? value;
export const priorityLabel = (value) => PRIORITIES.find((p) => p.value === value)?.label ?? value;

export const PROJECT_STATUS = {
  active: 'Attivo',
  archived: 'Archiviato',
  hidden: 'Oscurato',
};

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const dateShortFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

export const formatDate = (value) => (value ? dateFmt.format(new Date(value)) : '');
export const formatDateShort = (value) => (value ? dateShortFmt.format(new Date(value)) : '');
export const formatTime = (value) => timeFmt.format(new Date(value));

const startOfDay = (value) => new Date(value).setHours(0, 0, 0, 0);

// Giorni da oggi alla scadenza (negativo = scaduta, null = nessuna scadenza).
export function daysUntil(value) {
  if (!value) return null;
  return Math.round((startOfDay(value) - startOfDay(Date.now())) / 86400000);
}

// Testo e tono ("overdue" | "soon" | "") per mostrare una scadenza in modo coerente ovunque.
export function dueInfo(task) {
  const days = daysUntil(task.dueDate);
  if (days === null) return { text: 'Nessuna scadenza', tone: '', days };
  if (task.status === 'done') return { text: formatDateShort(task.dueDate), tone: '', days };
  if (days < 0) return { text: days === -1 ? 'Scaduto ieri' : `Scaduto da ${-days} giorni`, tone: 'overdue', days };
  if (days === 0) return { text: 'Scade oggi', tone: 'soon', days };
  if (days === 1) return { text: 'Scade domani', tone: 'soon', days };
  if (days <= 7) return { text: `Scade tra ${days} giorni`, tone: 'soon', days };
  return { text: formatDateShort(task.dueDate), tone: '', days };
}

// "2 ore fa", "ieri", "12 ott"...
export function timeAgo(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return 'adesso';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ieri';
  if (days < 7) return `${days} giorni fa`;
  return formatDate(value);
}

// Etichetta del giorno per i separatori della chat.
export function dayLabel(value) {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(value)) / 86400000);
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Ieri';
  return new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(value));
}

export const sameDay = (a, b) => startOfDay(a) === startOfDay(b);

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

// Valore per <input type="date"> a partire da una data ISO.
export const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

// Percorso in cui aprire la risorsa a cui si riferisce una notifica (null = nessuna pagina).
export function notificationLink(n) {
  const project = n.project && `/projects/${n.project}`;
  switch (n.type) {
    case 'project_invitation':
      return '/notifications';
    case 'task_assigned':
    case 'task_moved':
      return project && `${project}?tab=board${n.task ? `&task=${n.task}` : ''}`;
    case 'member_joined':
    case 'member_left':
    case 'invitation_declined':
      return project && `${project}?tab=members`;
    case 'project_reported':
      return '/admin?tab=reports';
    case 'project_hidden':
      return project;
    default:
      return null;
  }
}

// Messaggio d'errore da mostrare all'utente per qualsiasi errore delle API.
export const errorMessage = (err) => err?.message || 'Si è verificato un errore imprevisto';
