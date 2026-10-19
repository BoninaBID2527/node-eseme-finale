# Test end-to-end

Prova l'applicazione **vera** in un browser (Chromium via Playwright): due utenti contemporanei, sessione scaduta, progetti con copertina, inviti, task con drag and drop e da tastiera, sincronizzazione live, chat (anche con riconnessione), notifiche, catalogo con filtri, segnalazioni e moderazione, blocco utenti, accessi negati, mobile (390 px) e accessibilità con axe-core.

> **Attenzione:** il test crea utenti e progetti e modifica temporaneamente lo stato di alcuni dati dimostrativi (oscura un progetto, blocca e sblocca Marco, ecc.). Eseguilo su un **database di prova**, non su quello con i tuoi dati.

## Come si esegue

Da tre terminali, nella cartella `backend` e `frontend` (i comandi sono per macOS/Linux; su Windows PowerShell imposta le variabili con `$env:NOME="valore"`):

```bash
# 1) Backend su un database di prova e una porta dedicata
cd backend
MONGO_URI=mongodb://127.0.0.1:27017/taskflow_e2e npm run seed
MONGO_URI=mongodb://127.0.0.1:27017/taskflow_e2e PORT=4100 npm start

# 2) Frontend che punta a quel backend
cd frontend
VITE_BACKEND_URL=http://localhost:4100 npm run dev -- --port 5174

# 3) Il test
cd e2e
npm install
npx playwright install chromium      # una volta sola
BASE=http://localhost:5174 API=http://localhost:4100/api npm test
```

Il test stampa uno scenario per riga (`✓` / `✗`) e, in caso di errore, salva gli screenshot di tutte le pagine aperte in `e2e/screenshots/`. Termina con codice 0 solo se tutti gli scenari passano e non ci sono errori in console.

Per rilanciarlo conviene ripartire da un database pulito (il seed è non distruttivo ma i dati creati dal test restano).

## Variabili d'ambiente

| Variabile | Default | Significato |
| --- | --- | --- |
| `BASE` | `http://localhost:5173` | indirizzo del frontend |
| `API` | `http://localhost:4000/api` | indirizzo delle API |
| `JWT_SECRET` | `cambia-questo-segreto` | segreto del backend (serve a creare un token scaduto di prova) |
| `CHROME_PATH` | quello di Playwright | eseguibile di Chromium da usare |
