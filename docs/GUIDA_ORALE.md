# Guida alla discussione orale

Una traccia per presentare TaskFlow in 10–15 minuti e rispondere alle domande più probabili. Il codice citato è quello vero del progetto.

## 1. Il progetto in 30 secondi

> TaskFlow è una piattaforma per gestire progetti di gruppo: ogni progetto ha una **bacheca a colonne** (Da fare, In corso, Completato), una **chat**, dei **membri** e un **catalogo pubblico** in cui trovare progetti a cui unirsi. Quando qualcuno crea o sposta un task, chat e bacheca degli altri membri si aggiornano **in tempo reale**. Gli **amministratori** moderano i progetti segnalati e bloccano gli utenti.

**Stack:** Node.js + Express (API REST), MongoDB con Mongoose, Socket.IO (tempo reale), JWT per l'autenticazione, React + Vite per l'interfaccia.

## 2. Un percorso completo: dalla creazione di un task all'aggiornamento live sugli altri client

Elena e Marco sono nello stesso progetto, ognuno nel proprio browser. Elena crea un task e lo assegna a Marco.

```
 Browser di Elena                    Server                                    Browser di Marco
 ────────────────                    ──────                                    ────────────────
 1. TaskModal: submit
    api.post('/projects/:id/tasks')
        │  (fetch + header Authorization: Bearer <JWT>)
        ▼
                                  2. Express: routes/projectRoutes.js
                                     auth ─ verifica il JWT → req.user
                                     loadProject ─ carica il progetto, calcola isOwner/isMember
                                     requireMember ─ solo i membri
                                     requireWritable ─ il progetto non è archiviato/oscurato
                                     taskController.createTask
                                  3. Validator controlla i campi (400 con errori per campo);
                                     l'assegnatario deve essere membro del progetto
                                  4. Task.create(...) ──────────────► MongoDB (il task è salvato)
                                  5. emitToProject(id, 'task:created', task)
                                        └─ Socket.IO invia l'evento alla room "project:<id>"  ───►  6. useSocketEvent('task:created')
                                  6. notifyUser(Marco, 'task_assigned')                              upsert nello stato React:
                                        ├─ Notification.create (persistente)                         la scheda compare in "Da fare"
                                        └─ evento 'notification:new' alla room "user:<id>"  ───►     toast + contatore nella sidebar
        ◄──────────────────────── 201 { task }
 7. onSaved → upsert nello stato
    (evento e risposta HTTP non
     duplicano: si unisce per _id)
```

Punti da sottolineare:

- **La persistenza viene prima:** l'evento parte solo dopo `Task.create`. Se Marco ricarica la pagina, la GET dei task restituisce lo stesso task: il realtime è un *aggiunta*, non la fonte dei dati.
- **I permessi sono sul server**, in una catena di middleware leggibile (`auth → loadProject → requireMember → requireWritable`). L'interfaccia nasconde i pulsanti per comodità, ma non è l'unica difesa.
- **Nessun duplicato:** l'autore riceve sia la risposta HTTP sia l'evento; `useProjectTasks` fa un "upsert" per `_id`, quindi il task compare una volta sola.
- **Autorizzazione delle stanze:** il socket entra nella room `project:<id>` solo se l'utente è proprietario o membro (`sockets/index.js`); chi viene rimosso o bloccato viene tolto/disconnesso (`sockets/emit.js`).

File da aprire se te lo chiedono: `routes/projectRoutes.js`, `middleware/projectAccess.js`, `controllers/taskController.js`, `sockets/emit.js`, `hooks/useProjectTasks.js`, `components/Board.jsx`.

## 3. Scaletta di una demo di 5 minuti

Prepara due finestre (una in incognito) e `npm run seed`.

1. **Catalogo (senza login):** filtra per categoria e tecnologia, cerca "palestra", cambia ordinamento, mostra che i filtri finiscono nell'URL.
2. **Accedi come Giulia** (finestra 1) e **come Marco** (finestra 2). Apri lo stesso progetto: *Gestionale per la palestra*.
3. **Bacheca live:** Giulia crea un task assegnato a Marco → compare a Marco con un toast. Marco lo trascina in "In corso" → Giulia lo vede muoversi.
4. **Alternativa senza mouse:** sulla scheda, `Maiusc + →`, oppure il menu "Sposta in" (utile su smartphone).
5. **Chat:** un messaggio da una finestra arriva nell'altra.
6. **Inviti:** Marco ha un invito in sospeso (dashboard): lo accetta ed entra nel progetto; Giulia vede subito il nuovo membro.
7. **Segnalazione:** accedi come Sara in una terza finestra, segnala un progetto; l'admin (`admin@taskflow.test`) riceve la notifica live e può oscurare il progetto: sparisce dal catalogo e i suoi membri vengono espulsi.
8. **Permessi:** da Sara apri un progetto privato di Giulia → accesso negato; da un utente normale prova `/admin` → torna alla dashboard.

## 4. Domande probabili (e risposte brevi)

**Perché MongoDB?**
I dati sono documenti con liste annidate (tecnologie, membri) e relazioni semplici (utente ↔ progetto ↔ task). Mongoose aggiunge validazione e `enum`; dove serve un vincolo "forte" uso un indice (es. un solo invito `pending` per coppia progetto/utente).

**Come funziona l'autenticazione?**
Al login il server firma un JWT con `sub` (id utente), `role` e un `jti`. Il client lo manda in `Authorization: Bearer`. Ad ogni richiesta `authenticateToken` verifica firma e scadenza, controlla che il token non sia stato revocato (logout), che l'utente esista e non sia bloccato. Le password sono salvate con **bcrypt**.

**Il JWT è stateless: come fai il logout?**
Salvo il `jti` in una collezione `RevokedToken` con un indice TTL che lo elimina alla scadenza del token. Ogni richiesta controlla quella lista. Il logout chiude anche le connessioni Socket.IO di quel token.

**Come distingui utente, proprietario e amministratore?**
`admin` è un campo dell'utente. "Proprietario" e "membro" invece sono **relativi al progetto**: il middleware `loadProject` li calcola confrontando `project.owner` e `project.members` con l'utente. Ogni rotta dichiara chi può usarla (`requireOwner`, `requireMember`, `requireAdmin`).

**Perché REST *e* Socket.IO?**
REST è la fonte di verità: ogni modifica passa da lì ed è testabile (Postman, Jest). Socket.IO serve solo a *notificare* gli altri client dopo il salvataggio. Così se il socket cade non si perde nulla: alla riconnessione il frontend ricarica i dati via REST.

**Cosa succede se un utente viene bloccato mentre è connesso?**
Il server lo disconnette subito (`disconnectUser`) dopo avergli mandato `session:ended`; il frontend torna al login con un avviso. Le richieste successive con il suo token ricevono `403`, perché il blocco è controllato a ogni richiesta.

**Cosa succede a task e accessi quando si rimuove un membro?**
I task assegnati a lui restano senza assegnatario (e le bacheche si aggiornano live), perde l'accesso a bacheca e chat, esce dalla room Socket.IO e riceve una notifica.

**Differenza tra progetto archiviato e oscurato?**
*Archiviato* (dal proprietario): sola lettura per tutti, fuori dal catalogo, riattivabile. *Oscurato* (da un admin): sola lettura, visibile solo al proprietario e agli admin; i membri perdono accesso e connessione live. Le scritture su entrambi rispondono `409`.

**Come eviti i duplicati dei messaggi o dei task in tempo reale?**
Chi scrive riceve sia la risposta HTTP sia l'evento. Il frontend unisce per `_id` (`merge` in `Chat.jsx`, `upsert` in `useProjectTasks`).

**Come gestisci gli errori?**
I controller lanciano `AppError`; un middleware finale li trasforma in JSON `{ message, errors?, code? }` con il codice HTTP giusto. La validazione (`Validator`) restituisce un messaggio per ogni campo, che il frontend mostra accanto al campo. Express 5 inoltra automaticamente anche gli errori delle funzioni `async`.

**Come proteggi le copertine caricate?**
Solo JPG/PNG/WebP/GIF fino a 2 MB, nome generato dal server, controllo dei primi byte del file, niente SVG, file cancellato se il progetto viene eliminato o la copertina sostituita.

**Cosa non hai fatto e perché?**
Il recupero password via email: è opzionale e richiede un server SMTP; non voglio mostrare conferme finte. Altri limiti sono elencati nel README ("Limiti noti").

**Come hai verificato che funziona?**
Quattro livelli: 64 test di integrazione del backend (Jest/Supertest, compresi i test Socket.IO), la collection Postman eseguita con Newman (98 richieste, 147 verifiche), un test end-to-end nel browser con due utenti in parallelo (33 scenari) e un controllo di accessibilità con axe-core.

## 5. Se ti chiedono di modificare qualcosa dal vivo

| Richiesta | Dove mettere mano |
| --- | --- |
| Aggiungere un campo a un task | `models/Task.js`, `controllers/taskController.js` (validazione), `components/TaskModal.jsx` |
| Nuova colonna della bacheca | `STATUSES` in `frontend/src/utils.js` e l'`enum` di `models/Task.js` |
| Nuovo ruolo/permesso su una rotta | catena di middleware in `routes/projectRoutes.js` e `middleware/projectAccess.js` |
| Nuovo evento in tempo reale | `emitToProject(...)` nel controller e `useSocketEvent(...)` nel frontend |
| Cambiare i colori | variabili in `frontend/src/styles/tokens.css` |
