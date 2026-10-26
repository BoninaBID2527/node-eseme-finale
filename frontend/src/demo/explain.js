// Spiegazioni mostrate nel popup della demo: per ogni azione, cosa farebbe il backend vero.
// endpoint = la rotta Express chiamata · who = chi può usarla · steps = cosa succede sul server · live = eventi Socket.IO

const ID = '[^/]+';
const rules = [
  // ---------- account ----------
  ['POST', '/auth/login', {
    title: 'Accesso',
    who: 'Tutti',
    steps: [
      'Cerca l\'utente per email su MongoDB e confronta la password con l\'hash salvato (bcrypt).',
      'Se l\'account è bloccato risponde 403; con email o password sbagliate risponde 401, con lo stesso messaggio per non rivelare quali email esistono.',
      'Firma un token JWT valido 7 giorni, che il browser invia poi in ogni richiesta.',
      'Il limitatore accetta al massimo 10 tentativi ogni 15 minuti per coppia IP + email.',
    ],
    after: 'Nella demo entri comunque con l\'account dimostrativo scelto, per poter esplorare l\'app.',
  }],
  ['POST', '/auth/register', {
    title: 'Registrazione',
    who: 'Tutti',
    steps: [
      'Valida nome, email e password (almeno 8 caratteri) e segnala gli errori campo per campo.',
      'Rifiuta con 409 un\'email già registrata.',
      'Salva l\'utente con la password cifrata con bcrypt e restituisce subito un token JWT.',
    ],
    after: 'Nella demo non si creano account: usa uno degli account dimostrativi.',
  }],
  ['POST', '/auth/logout', {
    title: 'Uscita',
    who: 'Utente collegato',
    steps: [
      'Il JWT non ha stato: il server salva il suo identificativo (jti) tra i token revocati fino alla scadenza.',
      'Chiude le connessioni Socket.IO aperte con quel token.',
    ],
    after: 'Nella demo esci davvero e torni al catalogo.',
  }],
  ['PATCH', '/auth/me', {
    title: 'Modifica del profilo',
    who: 'Utente collegato',
    steps: ['Valida il nuovo nome e aggiorna il documento dell\'utente su MongoDB.'],
  }],
  ['PATCH', '/auth/password', {
    title: 'Cambio password',
    who: 'Utente collegato',
    steps: [
      'Verifica la password attuale e salva il nuovo hash bcrypt.',
      'Registra la data del cambio: i token emessi prima smettono di valere e le connessioni live vengono chiuse.',
      'Restituisce un nuovo token, così chi ha cambiato la password resta collegato.',
    ],
  }],

  // ---------- progetti ----------
  ['POST', '/projects', {
    title: 'Creazione di un progetto',
    who: 'Utente collegato',
    steps: [
      'Riceve i dati in multipart (testo + immagine di copertina) e valida titolo, descrizione, categoria, tecnologie e visibilità.',
      'La copertina deve essere JPG, PNG, WebP o GIF fino a 2 MB: il server controlla i primi byte del file e gli assegna un nome generato.',
      'Salva il progetto con l\'utente come proprietario.',
    ],
  }],
  ['PUT', `/projects/${ID}`, {
    title: 'Modifica del progetto',
    who: 'Proprietario, progetto attivo',
    steps: [
      'Controlla che chi scrive sia il proprietario e che il progetto non sia archiviato o oscurato (altrimenti 409).',
      'Aggiorna i campi e, se cambia la copertina, cancella dal disco quella vecchia.',
    ],
    live: 'project:updated a tutti i membri connessi.',
  }],
  ['PATCH', `/projects/${ID}/archive`, {
    title: 'Archiviazione del progetto',
    who: 'Proprietario',
    steps: [
      'Imposta lo stato "archived" (o di nuovo "active"): un progetto archiviato esce dal catalogo e diventa di sola lettura.',
      'Da quel momento ogni scrittura su task, chat e inviti riceve 409.',
      'Registra l\'azione nella cronologia del progetto.',
    ],
    live: 'project:updated: le bacheche aperte diventano di sola lettura in tempo reale.',
  }],
  ['DELETE', `/projects/${ID}`, {
    title: 'Eliminazione del progetto',
    who: 'Proprietario',
    steps: [
      'Cancella il progetto con task, commenti, cronologia, messaggi, inviti, segnalazioni, notifiche collegate e copertina.',
      'Toglie tutti i membri dalla room Socket.IO del progetto.',
    ],
    live: 'project:deleted a chi è connesso.',
  }],
  ['POST', `/projects/${ID}/report`, {
    title: 'Segnalazione del progetto',
    who: 'Chi vede il progetto, tranne il proprietario',
    steps: [
      'Valida il motivo e salva la segnalazione con stato "open" (una sola segnalazione aperta per utente).',
      'Avvisa tutti gli amministratori con una notifica.',
    ],
    live: 'notification:new agli amministratori.',
  }],

  // ---------- membri e inviti ----------
  ['POST', `/projects/${ID}/invitations`, {
    title: 'Invito di un utente',
    who: 'Proprietario, progetto attivo',
    steps: [
      'Cerca l\'utente per email: deve essere registrato, non bloccato e non già nel progetto.',
      'Un indice unico parziale su MongoDB impedisce due inviti in attesa per la stessa coppia progetto/utente.',
      'Crea l\'invito e una notifica per il destinatario, che entrerà solo se accetta.',
    ],
    live: 'invitation:created e notification:new al destinatario.',
  }],
  ['DELETE', `/projects/${ID}/invitations/${ID}`, {
    title: 'Annullamento dell\'invito',
    who: 'Proprietario',
    steps: ['Porta l\'invito in attesa allo stato "cancelled".'],
    live: 'invitation:updated al destinatario: l\'invito sparisce dalla sua dashboard.',
  }],
  ['DELETE', `/projects/${ID}/members/${ID}`, {
    title: 'Rimozione di un membro',
    who: 'Proprietario, progetto attivo',
    steps: [
      'Toglie l\'utente dai membri; i task che gli erano assegnati restano senza assegnatario.',
      'Lo fa uscire dalla room Socket.IO del progetto e gli invia una notifica.',
      'Registra l\'azione nella cronologia.',
    ],
    live: 'member:removed e task:updated a tutti i membri connessi.',
  }],
  ['POST', `/projects/${ID}/leave`, {
    title: 'Uscita dal progetto',
    who: 'Membro (non il proprietario)',
    steps: [
      'Toglie l\'utente dai membri e libera i task che aveva assegnati.',
      'Avvisa il proprietario con una notifica e registra l\'uscita nella cronologia.',
    ],
    live: 'member:removed agli altri membri.',
  }],
  ['POST', `/invitations/${ID}/accept`, {
    title: 'Accettazione dell\'invito',
    who: 'Destinatario dell\'invito',
    steps: [
      'Controlla che l\'invito sia ancora in attesa e il progetto ancora attivo.',
      'Aggiunge l\'utente ai membri con $addToSet (nessun doppione anche con due clic).',
      'Lo inserisce nella room del progetto, avvisa gli altri membri e registra l\'ingresso nella cronologia.',
    ],
    live: 'member:joined e notification:new ai membri.',
  }],
  ['POST', `/invitations/${ID}/decline`, {
    title: 'Rifiuto dell\'invito',
    who: 'Destinatario dell\'invito',
    steps: ['Porta l\'invito allo stato "declined" e avvisa il proprietario con una notifica.'],
  }],

  // ---------- task ----------
  ['POST', `/projects/${ID}/tasks`, {
    title: 'Creazione di un task',
    who: 'Membri, progetto attivo',
    steps: [
      'Valida titolo, descrizione, priorità, stato, scadenza ed etichette (al massimo 5, da 20 caratteri).',
      'L\'assegnatario deve essere il proprietario o un membro del progetto.',
      'Salva il task, avvisa l\'assegnatario e registra l\'azione nella cronologia.',
    ],
    live: 'task:created: il task compare sulle bacheche degli altri membri.',
  }],
  ['PUT', `/projects/${ID}/tasks/${ID}`, {
    title: 'Modifica del task',
    who: 'Membri, progetto attivo',
    steps: [
      'Aggiorna solo i campi inviati, con la stessa validazione della creazione.',
      'Se cambiano stato o assegnatario, invia le notifiche e scrive la cronologia.',
    ],
    live: 'task:updated a tutti i membri connessi.',
  }],
  ['PATCH', `/projects/${ID}/tasks/${ID}/status`, {
    title: 'Spostamento del task',
    who: 'Membri, progetto attivo',
    steps: [
      'Cambia la colonna del task (Da fare, In corso, Completato) e salva su MongoDB.',
      'Avvisa l\'assegnatario e registra lo spostamento nella cronologia.',
      'Se la richiesta fallisce, la bacheca riporta il task dove era.',
    ],
    live: 'task:moved: le bacheche degli altri membri si aggiornano da sole.',
  }],
  ['PATCH', `/projects/${ID}/tasks/${ID}/assignee`, {
    title: 'Assegnazione del task',
    who: 'Membri, progetto attivo',
    steps: ['Controlla che il nuovo assegnatario sia un membro, salva, notifica e registra nella cronologia.'],
    live: 'task:updated e notification:new al nuovo assegnatario.',
  }],
  ['DELETE', `/projects/${ID}/tasks/${ID}`, {
    title: 'Eliminazione del task',
    who: 'Membri, progetto attivo',
    steps: ['Cancella il task con i suoi commenti e registra l\'azione nella cronologia.'],
    live: 'task:deleted a tutti i membri connessi.',
  }],
  ['POST', `/projects/${ID}/tasks/${ID}/comments`, {
    title: 'Nuovo commento',
    who: 'Membri, progetto attivo',
    steps: [
      'Valida il testo (massimo 1000 caratteri) e salva il commento.',
      'Avvisa chi segue il task (assegnatario e autore), tranne chi ha scritto.',
    ],
    live: 'comment:created: il commento arriva subito agli altri membri.',
  }],
  ['DELETE', `/projects/${ID}/tasks/${ID}/comments/${ID}`, {
    title: 'Eliminazione del commento',
    who: 'Autore del commento o proprietario del progetto',
    steps: ['Controlla i permessi (403 se non sei autore né proprietario) e cancella il commento.'],
    live: 'comment:deleted a tutti i membri connessi.',
  }],

  // ---------- chat ----------
  ['POST', `/projects/${ID}/messages`, {
    title: 'Messaggio in chat',
    who: 'Membri, progetto attivo',
    steps: [
      'Valida il testo (massimo 2000 caratteri) e salva il messaggio su MongoDB.',
      'Solo dopo il salvataggio lo annuncia agli altri: se la connessione live cade, alla riconnessione basta rileggere la chat.',
    ],
    live: 'chat:message nella room del progetto.',
  }],

  // ---------- notifiche ----------
  ['PATCH', `/notifications/${ID}/read`, {
    title: 'Notifica letta',
    who: 'Destinatario della notifica',
    steps: ['Segna la notifica come letta: il contatore nella barra laterale scende di uno.'],
  }],
  ['PATCH', '/notifications/read-all', {
    title: 'Tutte le notifiche lette',
    who: 'Utente collegato',
    steps: ['Segna come lette tutte le notifiche dell\'utente con un solo updateMany.'],
  }],

  // ---------- amministrazione ----------
  ['PATCH', `/admin/reports/${ID}`, {
    title: 'Gestione della segnalazione',
    who: 'Amministratori',
    steps: ['Cambia lo stato della segnalazione (aperta, archiviata, gestita), salva la nota e chi l\'ha gestita.'],
  }],
  ['PATCH', `/admin/projects/${ID}/hide`, {
    title: 'Oscuramento del progetto',
    who: 'Amministratori',
    steps: [
      'Imposta lo stato "hidden": il progetto esce dal catalogo e resta visibile solo al proprietario (in sola lettura) e agli admin.',
      'Le segnalazioni aperte diventano "gestite" e il proprietario riceve una notifica.',
      'I membri vengono tolti subito dalla room Socket.IO del progetto.',
    ],
    live: 'project:updated ai membri, che perdono l\'accesso in tempo reale.',
  }],
  ['PATCH', `/admin/users/${ID}/block`, {
    title: 'Blocco dell\'utente',
    who: 'Amministratori (un admin non si può bloccare)',
    steps: [
      'Segna l\'utente come bloccato: da quel momento i suoi token ricevono 403 e il login viene rifiutato.',
      'Chiude subito le sue connessioni live.',
    ],
    live: 'session:ended all\'utente bloccato, che viene riportato al login.',
  }],
];

const compiled = rules.map(([method, pattern, info]) => [method, new RegExp(`^${pattern}$`), info]);

// Gli id diventano segnaposto leggibili, come nella documentazione delle API (es. /projects/:id/tasks/:taskId).
const PARAM = { projects: ':id', tasks: ':taskId', comments: ':commentId', members: ':userId', notifications: ':id', reports: ':id', users: ':id' };
function readablePath(path) {
  const parts = path.split('/');
  return parts
    .map((part, i) => {
      if (!/^[a-f0-9]{24}$/i.test(part)) return part;
      const prev = parts[i - 1];
      if (prev === 'invitations') return parts[1] === 'projects' ? ':invId' : ':id';
      if (prev === 'projects' && parts[1] === 'admin') return ':id';
      return PARAM[prev] || ':id';
    })
    .join('/');
}

export function explain(method, path) {
  const found = compiled.find(([m, re]) => m === method && re.test(path));
  const info = found ? found[2] : { title: 'Azione sul server', who: 'Utente collegato', steps: ['Questa azione modifica i dati su MongoDB tramite le API REST.'] };
  return { ...info, endpoint: `${method} /api${readablePath(path)}` };
}
