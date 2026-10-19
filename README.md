# TaskFlow

Piattaforma collaborativa di gestione progetti: bacheca a colonne ("Da fare", "In corso", "Completato"), chat interna, notifiche in tempo reale, catalogo pubblico con filtri e pannello di moderazione per gli amministratori.

Progetto d'esame finale Node.js. Il repository contiene:

| Cartella | Contenuto |
| --- | --- |
| `backend/` | API REST (Express) + tempo reale (Socket.IO) + MongoDB (Mongoose) |
| `frontend/` | Applicazione React (Vite) |
| `postman/` | Collection Postman per provare tutte le API |

## Requisiti

- **Node.js 20.19+** (o 22+) con npm
- **MongoDB** in uno di questi modi:
  - Docker: `docker compose up -d` (usa il `docker-compose.yml` in questa cartella)
  - MongoDB Community installato in locale (porta 27017)
  - un cluster gratuito su MongoDB Atlas (metti la stringa di connessione in `MONGO_URI`)

## Come si avvia

Servono **due terminali** (backend e frontend), più MongoDB acceso.

```bash
# 0) (opzionale) MongoDB con Docker, dalla cartella principale del progetto
docker compose up -d

# 1) Backend → http://localhost:4000
cd backend
npm install
cp .env.example .env        # su Windows: copy .env.example .env
npm run seed                # dati di esempio (opzionale ma consigliato)
npm run dev

# 2) Frontend → http://localhost:5173
cd frontend
npm install
npm run dev
```

Apri **http://localhost:5173**. In sviluppo il frontend inoltra `/api`, `/uploads` e `/socket.io` al backend (`vite.config.js`), quindi non servono configurazioni CORS.

### Account di prova (dopo `npm run seed`)

| Ruolo | Email | Password |
| --- | --- | --- |
| Amministratore | `admin@taskflow.test` | `admin1234` |
| Utente | `giulia@taskflow.test` | `password123` |
| Utente | `marco@taskflow.test` | `password123` |
| Utente | `sara@taskflow.test` | `password123` |

> `npm run seed` **svuota** il database indicato in `MONGO_URI` e lo ripopola con progetti, task e messaggi di esempio.

Per vedere il tempo reale: apri due finestre (una in incognito), accedi come Giulia e come Marco, entra nello stesso progetto e sposta un task o scrivi in chat.

### Configurazione (`backend/.env`)

| Variabile | Default | Significato |
| --- | --- | --- |
| `PORT` | `4000` | porta del backend |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/taskflow` | database |
| `JWT_SECRET` | `cambia-questo-segreto` | chiave per firmare i token (**cambiala**) |
| `JWT_EXPIRES_IN` | `7d` | durata del token |
| `CLIENT_URL` | `http://localhost:5173` | origine consentita da CORS e Socket.IO |

## Test

```bash
cd backend
npm test
```

Sono test di integrazione (Jest + Supertest) su un MongoDB reale: usano il database `taskflow_test` (modificabile con `MONGO_URI_TEST`) e lo svuotano ad ogni esecuzione. Coprono registrazione/login/logout, permessi per ruolo, filtri del catalogo, task e notifiche, dashboard, segnalazioni, admin e gli eventi Socket.IO.

## Collection Postman

1. Importa `postman/TaskFlow.postman_collection.json`.
2. Avvia backend e database ed esegui `npm run seed` (serve per l'admin).
3. Lancia la collection con il **Runner**: le request sono in ordine e salvano da sole `token`, `projectId`, `taskId`… nelle variabili. Il login imposta il token per le richieste successive.

Ogni request verifica anche il codice HTTP atteso (compresi i casi di errore 401/403).

## Funzionalità

- **Utenti:** registrazione, login, logout (il token viene revocato), profilo. Password salvate con bcrypt.
- **Ruoli:** utente, *proprietario* del singolo progetto (invita/rimuove membri, modifica, archivia, elimina) e amministratore (nasconde progetti segnalati, blocca utenti).
- **Progetti:** titolo, descrizione, categoria, tecnologie, visibilità pubblica/privata, immagine di copertina, archiviazione.
- **Task:** titolo, descrizione, scadenza, priorità, stato, assegnatario; spostamento tra colonne con drag and drop e riassegnazione.
- **Catalogo pubblico:** filtri per categoria, tecnologia, data di creazione e ricerca testuale.
- **Dashboard:** progetti creati, progetti di cui sei membro, task assegnati ordinati per scadenza.
- **Tempo reale:** bacheca, chat di progetto, notifiche (task assegnato o spostato, nuovo membro, progetto segnalato → admin).
- **Moderazione:** segnalazione dei progetti, pannello admin con segnalazioni e utenti.

## API REST

Tutte le rotte sono sotto `/api`. Gli errori hanno sempre la forma `{ "message": "..." }`. L'autenticazione usa l'header `Authorization: Bearer <token>`.

| Metodo | Rotta | Chi può usarla |
| --- | --- | --- |
| POST | `/auth/register` · `/auth/login` | tutti |
| POST | `/auth/logout` · GET `/auth/me` | utente loggato |
| GET | `/projects/public?category=&technology=&from=&to=&q=` | tutti (senza login) |
| POST | `/projects` (multipart, campo `cover`) | utente loggato |
| GET | `/projects/:id` | membri, admin; tutti se pubblico e non nascosto |
| PUT · DELETE | `/projects/:id` | proprietario |
| PATCH | `/projects/:id/archive` (`{ archived }`) | proprietario |
| POST | `/projects/:id/members` (`{ email }`) | proprietario |
| DELETE | `/projects/:id/members/:userId` | proprietario |
| GET · POST | `/projects/:id/tasks` | membri |
| PUT · DELETE | `/projects/:id/tasks/:taskId` | membri |
| PATCH | `/projects/:id/tasks/:taskId/status` (`{ status }`) | membri |
| PATCH | `/projects/:id/tasks/:taskId/assignee` (`{ assignee }`) | membri |
| GET · POST | `/projects/:id/messages` | membri |
| POST | `/projects/:id/report` (`{ reason }`) | utente loggato che può vedere il progetto |
| GET | `/dashboard` | utente loggato |
| GET | `/notifications` · PATCH `/notifications/:id/read` · PATCH `/notifications/read-all` | utente loggato |
| GET | `/admin/reports` · `/admin/users` | admin |
| PATCH | `/admin/projects/:id/hide` (`{ hidden }`) · `/admin/users/:id/block` (`{ blocked }`) | admin |

**Codici HTTP usati:** 200/201 successo · 400 dati non validi · 401 non autenticato o token revocato · 403 permessi insufficienti o utente bloccato · 404 risorsa inesistente · 409 duplicato (email, membro, segnalazione) · 500 errore interno (senza dettagli verso il client).

## Eventi Socket.IO

Il client si connette con `io({ auth: { token } })`. Il server verifica il JWT e inserisce il socket nelle room `user:<id>` (notifiche personali) e `project:<id>` per ogni suo progetto.

| Evento | Quando | Destinatari |
| --- | --- | --- |
| `task:created` · `task:updated` · `task:moved` · `task:deleted` | un task cambia | membri del progetto |
| `chat:message` | nuovo messaggio | membri del progetto |
| `member:joined` · `member:removed` | cambia la lista membri | membri del progetto |
| `notification:new` | task assegnato o spostato, nuovo membro, progetto segnalato | utente interessato (gli admin per le segnalazioni) |

Le REST sono la fonte di verità: ogni azione passa da una chiamata HTTP e solo dopo il salvataggio il server emette l'evento. Per questo tutto funziona anche senza Socket.IO (Postman compreso).

## Architettura e scelte

**Backend a livelli** (`backend/src`):

```
routes/       associano URL → middleware → controller
middleware/   auth (JWT), requireAdmin, projectAccess (ruoli sul progetto), upload (multer), errorHandler
controllers/  logica di ogni risorsa (auth, progetti, membri, task, chat, dashboard, notifiche, segnalazioni, admin)
models/       schemi Mongoose: User, Project, Task, Message, Notification, Report, RevokedToken
sockets/      autenticazione e room Socket.IO + helper per emettere eventi e creare notifiche
utils/        AppError, validazione, firma/verifica token
app.js        costruisce l'app Express (usata anche dai test)   server.js  avvia HTTP + Socket.IO
```

- **Perché MongoDB/Mongoose:** i dati sono documenti con liste annidate (tecnologie, membri) e le relazioni sono semplici; gli schemi Mongoose danno comunque validazione e valori ammessi (`enum`).
- **JWT + logout:** il token è stateless; al logout il suo identificativo (`jti`) viene salvato in `RevokedToken`, con un indice TTL che lo elimina alla scadenza. Il middleware controlla firma, revoca e blocco dell'utente ad ogni richiesta, e la stessa funzione (`authenticateToken`) protegge anche la connessione Socket.IO.
- **Ruoli:** `admin` è un campo dell'utente; "proprietario" e "membro" sono relativi al singolo progetto e vengono calcolati da `projectAccess` (`loadProject` → `canView` / `requireMember` / `requireOwner`). Così ogni rotta dichiara in una riga chi può usarla.
- **Gestione errori:** i controller lanciano `AppError(status, messaggio)`; Express 5 inoltra da solo anche gli errori delle funzioni `async` al middleware `errorHandler`, che risponde in JSON. Gli errori di Mongoose/multer vengono tradotti in 400/409.
- **Sicurezza di base:** password con bcrypt, hash mai incluso nelle risposte, ricerche con regex "escapate", upload limitato a immagini fino a 2 MB, stesso messaggio per email e password errate, progetti privati/nascosti non esposti.
- **Frontend:** React con Context per autenticazione, toast e connessione Socket.IO (una sola per utente). La bacheca aggiorna subito l'interfaccia al drag and drop e ripristina lo stato se il server rifiuta; gli eventi live fanno "upsert" per evitare duplicati.

## Produzione

```bash
cd frontend && npm run build     # genera frontend/dist
```

In produzione servi `dist/` con un web server che inoltri `/api`, `/uploads` e `/socket.io` al backend, imposta `JWT_SECRET` e `CLIENT_URL` e usa un MongoDB dedicato.

## Possibili estensioni

Recupero password via email (opzionale nella consegna), paginazione del catalogo e della chat, ordinamento manuale dei task nelle colonne, upload su storage esterno.
