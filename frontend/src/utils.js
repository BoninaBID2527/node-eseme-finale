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

export const CATEGORIES = ['Web', 'Mobile', 'Design', 'Dati', 'Documentazione', 'Altro'];

export const priorityLabel = (value) => PRIORITIES.find((p) => p.value === value)?.label ?? value;

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(value) {
  return new Date(value).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// Giorni da oggi alla scadenza (negativo = scaduta).
export function daysUntil(value) {
  if (!value) return null;
  const start = new Date().setHours(0, 0, 0, 0);
  const due = new Date(value).setHours(0, 0, 0, 0);
  return Math.round((due - start) / 86400000);
}

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
