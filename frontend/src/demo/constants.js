// Modalità demo: la build per GitHub Pages (npm run build:demo) funziona senza backend.
export const DEMO = import.meta.env.MODE === 'demo';
export const DEMO_MESSAGE = 'Demo: nessuna modifica è stata salvata.';
export const DEMO_ACCOUNTS = [
  { label: 'Giulia (utente)', email: 'giulia@taskflow.test', password: 'password123' },
  { label: 'Marco (utente)', email: 'marco@taskflow.test', password: 'password123' },
  { label: 'Amministratore', email: 'admin@taskflow.test', password: 'admin1234' },
];
