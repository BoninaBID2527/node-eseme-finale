// Contenuti dimostrativi (utenti, progetti, task, messaggi). Le scadenze sono giorni da oggi (negativo = passato).
// Sono dati d'esempio per provare l'app: gli account usano il dominio fittizio @taskflow.test.

const users = [
  { key: 'admin', name: 'Amministratore', email: 'admin@taskflow.test', password: 'admin1234', role: 'admin' },
  { key: 'giulia', name: 'Giulia Rossi', email: 'giulia@taskflow.test', password: 'password123' },
  { key: 'marco', name: 'Marco Bianchi', email: 'marco@taskflow.test', password: 'password123' },
  { key: 'sara', name: 'Sara Verdi', email: 'sara@taskflow.test', password: 'password123' },
  { key: 'luca', name: 'Luca Esposito', email: 'luca@taskflow.test', password: 'password123' },
];

const projects = [
  {
    key: 'palestra',
    title: 'Gestionale per la palestra',
    description: 'Gestione di abbonamenti, corsi e prenotazioni per una palestra di quartiere, con area riservata agli istruttori.',
    category: 'Web',
    technologies: ['React', 'Node.js', 'MongoDB'],
    owner: 'giulia',
    members: ['marco', 'sara'],
    createdDaysAgo: 21,
    tasks: [
      { title: 'Schema del database degli abbonamenti', priority: 'high', status: 'done', due: -9, assignee: 'sara' },
      { title: 'Login e ruoli (istruttore / socio)', priority: 'high', status: 'done', due: -6, assignee: 'giulia' },
      { title: 'Calendario dei corsi', description: 'Vista settimanale con filtro per istruttore e sala.', priority: 'high', status: 'in_progress', due: 2, assignee: 'marco' },
      { title: 'Prenotazione di un posto al corso', priority: 'medium', status: 'in_progress', due: 5, assignee: 'giulia' },
      { title: 'Promemoria via email prima della lezione', priority: 'medium', status: 'todo', due: 9, assignee: 'sara' },
      { title: 'Export mensile delle presenze in CSV', priority: 'low', status: 'todo', due: 16 },
      { title: 'Correggere il fuso orario nelle prenotazioni', description: 'Le prenotazioni serali risultano spostate di un giorno.', priority: 'high', status: 'todo', due: -2, assignee: 'marco' },
    ],
    messages: [
      { author: 'giulia', text: 'Ciao a tutti! Ho preparato la bacheca: scegliete un task e assegnatevelo.' },
      { author: 'marco', text: 'Parto dal calendario dei corsi, ho già lo schema delle sale.' },
      { author: 'sara', text: 'Il modello degli abbonamenti è pronto, l\'ho segnato come completato.' },
      { author: 'giulia', text: 'Perfetto. Marco, ricordati anche del bug sul fuso orario, è urgente.' },
      { author: 'marco', text: 'Ricevuto, lo sistemo prima di domani.' },
    ],
  },
  {
    key: 'allenamenti',
    title: 'App per tenere traccia degli allenamenti',
    description: 'App mobile per registrare esercizi, serie e carichi, con grafici dei progressi settimanali.',
    category: 'Mobile',
    technologies: ['Flutter', 'Firebase'],
    owner: 'marco',
    members: ['giulia'],
    createdDaysAgo: 14,
    tasks: [
      { title: 'Schermata di registrazione dell\'allenamento', priority: 'high', status: 'in_progress', due: 1, assignee: 'giulia' },
      { title: 'Archivio degli esercizi', priority: 'medium', status: 'todo', due: 7, assignee: 'marco' },
      { title: 'Grafico dei progressi', priority: 'low', status: 'todo', due: 20 },
    ],
    messages: [
      { author: 'marco', text: 'Ho creato il progetto Firebase, vi mando gli accessi in privato.' },
      { author: 'giulia', text: 'Grazie! Comincio dalla schermata di registrazione.' },
    ],
  },
  {
    key: 'eventi',
    title: 'Portale degli eventi del quartiere',
    description: 'Sito dove associazioni e negozi del quartiere pubblicano eventi, con calendario e iscrizione.',
    category: 'Web',
    technologies: ['Vue', 'Express', 'PostgreSQL'],
    owner: 'sara',
    members: [],
    createdDaysAgo: 10,
    tasks: [
      { title: 'Wireframe della home', priority: 'medium', status: 'done', due: -4, assignee: 'sara' },
      { title: 'Pagina dell\'evento con mappa', priority: 'medium', status: 'todo', due: 12, assignee: 'sara' },
    ],
  },
  {
    key: 'vendite',
    title: 'Dashboard vendite del negozio online',
    description: 'Report interattivi su ordini, resi e margini per capire quali prodotti rendono di più.',
    category: 'Dati',
    technologies: ['Python', 'Pandas', 'PostgreSQL'],
    owner: 'sara',
    members: ['giulia'],
    createdDaysAgo: 7,
    tasks: [
      { title: 'Importare gli ordini degli ultimi 12 mesi', priority: 'high', status: 'done', due: -3, assignee: 'sara' },
      { title: 'Pulizia dei dati dei resi', priority: 'medium', status: 'in_progress', due: 3, assignee: 'giulia' },
      { title: 'Grafico del margine per categoria', priority: 'medium', status: 'todo', due: 8, assignee: 'sara' },
    ],
  },
  {
    key: 'ui',
    title: 'Libreria di componenti UI',
    description: 'Raccolta di componenti accessibili e documentati da riutilizzare nei progetti del gruppo.',
    category: 'Design',
    technologies: ['Figma', 'React', 'Storybook'],
    owner: 'giulia',
    members: [],
    createdDaysAgo: 5,
    tasks: [
      { title: 'Definire palette e tipografia', priority: 'high', status: 'in_progress', due: 4, assignee: 'giulia' },
      { title: 'Componente Button con tutti gli stati', priority: 'medium', status: 'todo', due: 10 },
    ],
  },
  {
    key: 'docs',
    title: 'Documentazione delle API pubbliche',
    description: 'Scrittura della documentazione OpenAPI e degli esempi Postman per le API di un gestionale.',
    category: 'Documentazione',
    technologies: ['OpenAPI', 'Markdown', 'Postman'],
    owner: 'sara',
    members: ['giulia', 'luca'],
    createdDaysAgo: 18,
    tasks: [
      { title: 'Descrivere gli endpoint di autenticazione', priority: 'medium', status: 'todo', due: 6, assignee: 'giulia' },
      { title: 'Esempi di errore per ogni endpoint', priority: 'low', status: 'todo', due: 13, assignee: 'luca' },
      { title: 'Collection Postman', priority: 'medium', status: 'in_progress', due: 3, assignee: 'sara' },
    ],
    messages: [
      { author: 'sara', text: 'Ho preparato la struttura della documentazione, guardate la cartella /docs.' },
      { author: 'luca', text: 'Mi prendo gli esempi di errore, ci lavoro nel weekend.' },
    ],
  },
  {
    key: 'bot',
    title: 'Bot per le prenotazioni dei campi sportivi',
    description: 'Bot Telegram per prenotare i campi del centro sportivo e ricevere un promemoria.',
    category: 'Altro',
    technologies: ['Node.js', 'Telegram'],
    owner: 'marco',
    members: [],
    createdDaysAgo: 3,
    tasks: [{ title: 'Registrare il bot e leggere i messaggi', priority: 'medium', status: 'todo', due: 5, assignee: 'marco' }],
  },
  {
    key: 'tesi',
    title: 'Archivio tesi 2025',
    description: 'Catalogazione delle tesi discusse nel 2025. Il progetto è concluso ed è stato archiviato.',
    category: 'Documentazione',
    technologies: ['Markdown'],
    owner: 'sara',
    members: [],
    status: 'archived',
    createdDaysAgo: 60,
    tasks: [{ title: 'Catalogare le tesi di informatica', priority: 'low', status: 'done', due: -40, assignee: 'sara' }],
  },
  {
    key: 'riservato',
    title: 'Piano di studio personale',
    description: 'Appunti e scadenze degli esami. Progetto privato, visibile solo ai membri.',
    category: 'Altro',
    technologies: ['Notion'],
    visibility: 'private',
    owner: 'giulia',
    members: [],
    createdDaysAgo: 30,
    tasks: [{ title: 'Ripassare Node.js per l\'esame', priority: 'high', status: 'in_progress', due: 8, assignee: 'giulia' }],
  },
  {
    key: 'spam',
    title: 'Guadagna subito lavorando da casa!!!',
    description: 'Clicca sul link nel profilo e scopri come fare soldi facili. Offerta limitata, iscriviti adesso.',
    category: 'Altro',
    technologies: ['Marketing'],
    owner: 'luca',
    members: [],
    createdDaysAgo: 1,
  },
];

// Inviti in attesa, per provare accettazione e rifiuto.
const invitations = [
  { project: 'vendite', inviter: 'sara', invitee: 'marco' },
  { project: 'bot', inviter: 'marco', invitee: 'giulia' },
];

// Una segnalazione aperta, per provare la moderazione nel pannello admin.
const reports = [{ project: 'spam', reporter: 'giulia', reason: 'Sembra spam: promette guadagni facili e rimanda a un link esterno.' }];

module.exports = { users, projects, invitations, reports };
