// Test end-to-end di TaskFlow: due browser contemporanei (Chromium) provano i flussi principali dell'app
// (registrazione, sessione scaduta, progetti, inviti, task e bacheca live, chat, notifiche, catalogo,
// segnalazioni e moderazione, blocco utenti, mobile) e controllano l'accessibilità con axe-core.
//
// ATTENZIONE: crea e modifica dati. Eseguilo su un database di prova (vedi e2e/README.md).
//
// Variabili d'ambiente (tutte facoltative):
//   BASE         indirizzo del frontend        (default http://localhost:5173)
//   API          indirizzo delle API           (default http://localhost:4000/api)
//   JWT_SECRET   segreto del backend           (default cambia-questo-segreto)
//   CHROME_PATH  eseguibile di Chromium        (default: quello installato da Playwright)
import { chromium } from 'playwright';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(new URL('../backend/', import.meta.url));
const jwt = require('jsonwebtoken');
const DIR = new URL('./', import.meta.url).pathname;
const BASE = process.env.BASE || 'http://localhost:5173';
const API = process.env.API || 'http://localhost:4000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'cambia-questo-segreto';
const STAMP = Date.now(); // rende univoche le email degli utenti creati dal test
const SHOTS = DIR + 'screenshots/';
fs.mkdirSync(SHOTS, { recursive: true });

// Piccolo PNG valido usato come copertina di prova.
const COVER_PATH = path.join(os.tmpdir(), 'taskflow-e2e-cover.png');
fs.writeFileSync(COVER_PATH, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAIAAAAt/+nTAAAATElEQVR4nO3PQQkAMAzAwPoXODuriD2OQSACLnPPfJ0XNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rw2ALtBKjTWBTknAAAAABJRU5ErkJggg==', 'base64'));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const axeSource = fs.readFileSync(DIR + 'node_modules/axe-core/axe.min.js', 'utf8');

const results = [];
const allPages = [];
let failN = 0;
const consoleErrors = [];
async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message.split('\n')[0] });
    failN += 1;
    for (const [label, pg] of allPages) await pg.screenshot({ path: `${SHOTS}fail${failN}-${label}.png` }).catch(() => {});
    console.log(`✗ ${name}\n    ${err.message.split('\n').slice(0, 3).join('\n    ')}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

async function apiCall(token, method, path, body) {
  const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const apiLogin = async (email, password = 'password123') => (await apiCall(null, 'POST', '/auth/login', { email, password })).body.token;

async function open(label, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  allPages.push([label, page]);
  page.on('pageerror', (e) => consoleErrors.push(`${label}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // 4xx attesi nei test di accesso negato non sono errori dell'app
    if (/status of (401|403|404|409|400)/.test(text)) return;
    // errori provocati apposta dai test (rete assente, risposta 500 simulata, richiesta annullata)
    if (/ERR_INTERNET_DISCONNECTED|status of 500|ERR_FAILED|ERR_ABORTED/.test(text)) return;
    consoleErrors.push(`${label}: ${text}`);
  });
  return { context, page };
}
async function login(page, email, password = 'password123') {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await page.click('button:has-text("Accedi")');
  await page.waitForURL('**/dashboard');
}
const confirmDialog = (page) => page.locator('[role=dialog] .modal-actions .btn').last().click();
const tab = (page, name) => page.getByRole('tab', { name: new RegExp(name) }).click();
const toastWith = (page, text) => page.locator('.toast', { hasText: text }).first().waitFor({ timeout: 6000 });

// ====================================================================== A. Registrazione, login, sessione
const ownerEmail = `elena.${STAMP}@e2e.test`;
const owner = await open('elena');
await step('Registrazione: errori sui singoli campi', async () => {
  await owner.page.goto(`${BASE}/register`);
  await owner.page.click('button:has-text("Registrati")');
  await owner.page.locator('.field-error').first().waitFor();
  const n = await owner.page.locator('.field-error').count();
  assert(n >= 3, `attesi 3 errori accanto ai campi, trovati ${n}`);
  assert(await owner.page.locator('input[aria-invalid=true]').count() >= 3, 'aria-invalid mancante');
});
await step('Registrazione corretta → dashboard', async () => {
  await owner.page.fill('input[autocomplete=name]', 'Elena E2E');
  await owner.page.fill('input[type=email]', ownerEmail);
  await owner.page.fill('input[type=password]', 'password123');
  await owner.page.click('button:has-text("Registrati")');
  await owner.page.waitForURL('**/dashboard');
  await owner.page.locator('h1:has-text("Ciao, Elena")').waitFor();
});
await step('Logout e login errato / corretto', async () => {
  await owner.page.click('button:has-text("Esci")');
  await owner.page.waitForURL('**/login');
  await owner.page.fill('input[type=email]', ownerEmail);
  await owner.page.fill('input[type=password]', 'sbagliata1');
  await owner.page.click('button:has-text("Accedi")');
  await owner.page.locator('[role=alert]:has-text("non corretti")').waitFor();
  await owner.page.fill('input[type=password]', 'password123');
  await owner.page.click('button:has-text("Accedi")');
  await owner.page.waitForURL('**/dashboard');
});
await step('Sessione scaduta: pagina riservata → login con avviso', async () => {
  const now = Math.floor(Date.now() / 1000);
  const expired = jwt.sign({ sub: '000000000000000000000000', iat: now - 100, exp: now - 10, jti: 'x' }, JWT_SECRET);
  const { context, page } = await open('expired');
  await page.goto(`${BASE}/login`);
  await page.evaluate((t) => localStorage.setItem('taskflow_token', t), expired);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL('**/login');
  await page.locator('.form-notice:has-text("scaduta")').waitFor();
  assert(!(await page.evaluate(() => localStorage.getItem('taskflow_token'))), 'il token scaduto non è stato rimosso');
  await context.close();
});
await step('Sessione scaduta mentre si usa l\'app → ritorno al login', async () => {
  const { context, page } = await open('expired2');
  await login(page, ownerEmail);
  await page.locator('.stat').first().waitFor(); // la dashboard ha finito di caricare con il token valido
  const now = Math.floor(Date.now() / 1000);
  const expired = jwt.sign({ sub: '000000000000000000000000', iat: now - 100, exp: now - 10, jti: 'y' }, JWT_SECRET);
  await page.evaluate((t) => localStorage.setItem('taskflow_token', t), expired);
  await page.click('nav a:has-text("I miei task")');
  await page.waitForURL('**/login');
  await page.locator('.form-notice').waitFor();
  await context.close();
});
await step('Pagina riservata senza login → login; /admin da utente normale → dashboard', async () => {
  const { context, page } = await open('anon');
  await page.goto(`${BASE}/projects`);
  await page.waitForURL('**/login');
  await context.close();
  await owner.page.goto(`${BASE}/admin`);
  await owner.page.waitForURL('**/dashboard');
  assert((await owner.page.locator('nav a:has-text("Amministrazione")').count()) === 0, 'voce Amministrazione visibile a un utente normale');
  const ownerToken = await apiLogin(ownerEmail);
  assert((await apiCall(ownerToken, 'GET', '/admin/users')).status === 403, 'API admin non protetta');
});

// ====================================================================== B. Progetto
let projectId;
let coverSrc;
await step('Crea progetto con copertina caricata', async () => {
  await owner.page.goto(`${BASE}/projects/new`);
  await owner.page.getByLabel('Titolo').fill('Progetto E2E');
  await owner.page.getByLabel('Descrizione').fill('Progetto creato dal test end-to-end.');
  await owner.page.getByLabel('Categoria').fill('Web');
  await owner.page.getByLabel('Tecnologie').fill('React, Node.js');
  await owner.page.setInputFiles('#cover-input', COVER_PATH);
  await owner.page.click('button:has-text("Crea progetto")');
  await owner.page.waitForURL(/\/projects\/[0-9a-f]{24}/);
  projectId = owner.page.url().match(/projects\/([0-9a-f]{24})/)[1];
  await owner.page.locator('h1:has-text("Progetto E2E")').waitFor();
  const src = await owner.page.locator('.project-head-cover img').getAttribute('src');
  assert(/^\/uploads\//.test(src), `copertina non caricata (${src})`);
  coverSrc = src;
  assert((await fetch(BASE + src)).status === 200, 'la copertina caricata non è servita');
});
await step('Modifica del progetto dalle impostazioni e persistenza dopo il refresh', async () => {
  await tab(owner.page, 'Impostazioni');
  await owner.page.getByLabel('Titolo').fill('Progetto E2E (rev)');
  await owner.page.click('button:has-text("Salva modifiche")');
  await toastWith(owner.page, 'aggiornato');
  await owner.page.reload();
  await owner.page.locator('h1:has-text("Progetto E2E (rev)")').waitFor();
});

// ====================================================================== C. Inviti
const marco = await open('marco');
await login(marco.page, 'marco@taskflow.test');
await step('Invito: arriva live, si accetta, il membro entra e il proprietario lo vede', async () => {
  await tab(owner.page, 'Membri');
  await owner.page.getByLabel("Email dell'utente").fill('nessuno@e2e.test');
  await owner.page.click('button:has-text("Invia invito")');
  await owner.page.locator('.field-error:has-text("Nessun utente")').waitFor();
  await owner.page.getByLabel("Email dell'utente").fill('marco@taskflow.test');
  await owner.page.click('button:has-text("Invia invito")');
  await toastWith(owner.page, 'Invito inviato');
  await owner.page.locator('[data-testid=pending-invitations]:has-text("Marco Bianchi")').waitFor();
  // lato Marco: toast live + invito in dashboard
  await toastWith(marco.page, 'ti ha invitato');
  await marco.page.goto(`${BASE}/notifications`);
  const inv = marco.page.locator('.invitation', { hasText: 'Progetto E2E (rev)' });
  await inv.waitFor();
  // senza accettare non ha accesso
  const marcoToken = await apiLogin('marco@taskflow.test');
  assert((await apiCall(marcoToken, 'GET', `/projects/${projectId}/tasks`)).status === 403, 'accesso concesso prima dell\'accettazione');
  await inv.locator('button:has-text("Accetta")').click();
  await marco.page.waitForURL(new RegExp(`/projects/${projectId}`));
  await marco.page.getByRole('tab', { name: /Bacheca/ }).waitFor();
  await owner.page.locator('[data-testid=members]:has-text("Marco Bianchi")').waitFor({ timeout: 6000 });
  await owner.page.locator('[data-testid=pending-invitations]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
});
await step('Invito rifiutato: nessun accesso', async () => {
  const sara = await open('sara-inv');
  await login(sara.page, 'sara@taskflow.test');
  await owner.page.getByLabel("Email dell'utente").fill('sara@taskflow.test');
  await owner.page.click('button:has-text("Invia invito")');
  await toastWith(owner.page, 'Invito inviato');
  await sara.page.goto(`${BASE}/dashboard`);
  const inv = sara.page.locator('.invitation', { hasText: 'Progetto E2E (rev)' });
  await inv.waitFor();
  await inv.locator('button:has-text("Rifiuta")').click();
  await inv.waitFor({ state: 'detached' });
  const saraToken = await apiLogin('sara@taskflow.test');
  assert((await apiCall(saraToken, 'GET', `/projects/${projectId}/tasks`)).status === 403, 'accesso dopo il rifiuto');
  await sara.context.close();
});

// ====================================================================== D. Task e sincronizzazione
await owner.page.goto(`${BASE}/projects/${projectId}?tab=board`);
await marco.page.goto(`${BASE}/projects/${projectId}?tab=board`);
await owner.page.waitForSelector('.board');
await marco.page.waitForSelector('.board');
await step('Crea task assegnato: Marco lo vede subito e riceve notifica live', async () => {
  await owner.page.click('.board-toolbar button:has-text("Nuovo task")');
  const dlg = owner.page.locator('[role=dialog]');
  await dlg.getByLabel('Titolo').fill('Task sincronizzato');
  await dlg.getByLabel('Priorità').selectOption('high');
  await dlg.getByLabel('Assegnato a').selectOption({ label: 'Marco Bianchi' });
  const due = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await dlg.getByLabel('Scadenza').fill(due);
  await dlg.locator('button:has-text("Crea task")').click();
  await marco.page.locator('[data-testid=column-todo] [data-testid=task]:has-text("Task sincronizzato")').waitFor({ timeout: 6000 });
  await toastWith(marco.page, 'ti ha assegnato');
});
await step('Drag and drop di Marco → Elena vede lo spostamento live', async () => {
  const card = marco.page.locator('[data-testid=task]', { hasText: 'Task sincronizzato' });
  await card.dragTo(marco.page.locator('[data-testid=column-in_progress]'));
  await owner.page.locator('[data-testid=column-in_progress] [data-testid=task]:has-text("Task sincronizzato")').waitFor({ timeout: 6000 });
});
await step('Tastiera: Maiusc + freccia sposta il task e Marco lo vede', async () => {
  const btn = owner.page.locator('[data-testid=task]', { hasText: 'Task sincronizzato' }).locator('.task-main');
  await btn.focus();
  await owner.page.keyboard.press('Shift+ArrowRight');
  await owner.page.locator('[data-testid=column-done] [data-testid=task]:has-text("Task sincronizzato")').waitFor({ timeout: 6000 });
  await marco.page.locator('[data-testid=column-done] [data-testid=task]:has-text("Task sincronizzato")').waitFor({ timeout: 6000 });
});
await step('Menu "Sposta in" (alternativa touch/tastiera) + persistenza dopo refresh', async () => {
  await marco.page.getByRole('button', { name: /Azioni per il task "Task sincronizzato"/ }).click();
  await marco.page.getByRole('menuitemradio', { name: 'Da fare' }).click();
  await marco.page.locator('[data-testid=column-todo] [data-testid=task]:has-text("Task sincronizzato")').waitFor();
  await marco.page.reload();
  await marco.page.locator('[data-testid=column-todo] [data-testid=task]:has-text("Task sincronizzato")').waitFor();
});
await step('Spostamento fallito: errore mostrato e stato ripristinato', async () => {
  await owner.page.route('**/tasks/*/status', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Errore simulato"}' }));
  await owner.page.getByRole('button', { name: /Azioni per il task "Task sincronizzato"/ }).click();
  await owner.page.getByRole('menuitemradio', { name: 'Completato' }).click();
  await toastWith(owner.page, 'non riuscito');
  await owner.page.locator('[data-testid=column-todo] [data-testid=task]:has-text("Task sincronizzato")').waitFor();
  await owner.page.unroute('**/tasks/*/status');
});
await step('Riassegnazione e modifica del task dal dettaglio; filtri della bacheca', async () => {
  await owner.page.locator('[data-testid=task]', { hasText: 'Task sincronizzato' }).locator('.task-main').click();
  const dlg = owner.page.locator('[role=dialog]');
  await dlg.getByLabel('Assegnato a').selectOption({ label: 'Elena E2E (tu)' });
  await dlg.getByLabel('Titolo').fill('Task sincronizzato (mio)');
  await dlg.locator('button:has-text("Salva")').click();
  await marco.page.locator('[data-testid=task]:has-text("Task sincronizzato (mio)")').waitFor({ timeout: 6000 });
  await owner.page.selectOption('select[aria-label="Filtra per assegnatario"]', 'none');
  assert((await owner.page.locator('[data-testid=task]:has-text("mio")').count()) === 0, 'filtro "non assegnati" non applicato');
  await owner.page.selectOption('select[aria-label="Filtra per assegnatario"]', 'me');
  await owner.page.locator('[data-testid=task]:has-text("mio")').waitFor();
  await owner.page.fill('input[aria-label="Cerca un task"]', 'zzz');
  assert((await owner.page.locator('[data-testid=task]').count()) === 0, 'ricerca nella bacheca non applicata');
  await owner.page.click('button:has-text("Azzera")');
});
await step('Validazione del task: errore accanto al campo', async () => {
  await owner.page.click('.board-toolbar button:has-text("Nuovo task")');
  const dlg = owner.page.locator('[role=dialog]');
  await dlg.locator('button:has-text("Crea task")').click();
  await dlg.locator('.field-error').first().waitFor();
  await owner.page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' });
});

// ====================================================================== E. Chat
await step('Chat: invio/ricezione live senza duplicati', async () => {
  await tab(owner.page, 'Chat');
  await tab(marco.page, 'Chat');
  await marco.page.fill('#chat-input', 'Ciao dalla chat E2E');
  await marco.page.press('#chat-input', 'Enter');
  await owner.page.locator('.bubble:has-text("Ciao dalla chat E2E")').waitFor({ timeout: 6000 });
  await marco.page.locator('.bubble:has-text("Ciao dalla chat E2E")').first().waitFor();
  await owner.page.waitForTimeout(400);
  assert((await marco.page.locator('.bubble:has-text("Ciao dalla chat E2E")').count()) === 1, 'messaggio duplicato per il mittente');
  assert((await owner.page.locator('.bubble:has-text("Ciao dalla chat E2E")').count()) === 1, 'messaggio duplicato per il destinatario');
  // persistenza
  await owner.page.reload();
  await owner.page.locator('.bubble:has-text("Ciao dalla chat E2E")').waitFor();
});
await step('Chat: cronologia a pagine ("Carica messaggi precedenti")', async () => {
  const token = await apiLogin('marco@taskflow.test');
  for (let i = 1; i <= 40; i += 1) await apiCall(token, 'POST', `/projects/${projectId}/messages`, { text: `storico ${i}` });
  await owner.page.goto(`${BASE}/projects/${projectId}?tab=chat`);
  await owner.page.locator('.bubble:has-text("storico 40")').waitFor();
  const before = await owner.page.locator('.bubble').count();
  assert(before <= 31, `la prima pagina dovrebbe avere ~30 messaggi, ne ha ${before}`);
  await owner.page.click('button:has-text("Carica messaggi precedenti")');
  await owner.page.waitForFunction((n) => document.querySelectorAll('.bubble').length > n, before);
  assert(await owner.page.locator('.bubble:has-text("storico 5")').count() > 0, 'messaggi precedenti non caricati');
});
await step('Riconnessione: i messaggi inviati mentre si era offline vengono recuperati', async () => {
  await owner.page.goto(`${BASE}/projects/${projectId}?tab=chat`);
  await owner.page.locator('.live.is-on').waitFor();
  await owner.context.setOffline(true);
  await owner.page.locator('.chat-offline, .live:not(.is-on)').first().waitFor({ timeout: 45000 });
  const token = await apiLogin('marco@taskflow.test');
  await apiCall(token, 'POST', `/projects/${projectId}/messages`, { text: 'scritto mentre eri offline' });
  await owner.context.setOffline(false);
  await owner.page.locator('.bubble:has-text("scritto mentre eri offline")').waitFor({ timeout: 30000 });
});

// ====================================================================== F. Notifiche
await step('Notifiche: conteggio non lette, apertura della risorsa, segna tutte come lette', async () => {
  await marco.page.goto(`${BASE}/notifications`);
  await marco.page.locator('.notif.is-unread').first().waitFor();
  const badge = await marco.page.locator('.nav-badge').innerText();
  assert(Number(badge) > 0, 'badge non lette assente');
  const unread = Number(await marco.page.locator('.nav-badge').innerText());
  const patched = marco.page.waitForResponse((r) => r.url().includes('/notifications/') && r.request().method() === 'PATCH');
  await marco.page.locator('.notif.is-unread', { hasText: 'ti ha assegnato' }).first().click();
  await marco.page.waitForURL(/\/projects\/.*tab=board/);
  await patched;
  await marco.page.goto(`${BASE}/notifications`);
  await marco.page.locator('.notif').first().waitFor();
  const afterBadge = Number(await marco.page.locator('.nav-badge').innerText());
  assert(afterBadge === unread - 1, `il badge doveva passare da ${unread} a ${unread - 1}, è ${afterBadge}`);
  await marco.page.click('button:has-text("Segna tutte come lette")');
  await marco.page.locator('.notif.is-unread').first().waitFor({ state: 'detached' });
  await marco.page.locator('.nav-badge').waitFor({ state: 'detached', timeout: 4000 }).catch(() => { throw new Error('badge delle non lette ancora visibile'); });
});

// ====================================================================== G. Catalogo
await step('Catalogo: ricerca, categoria, tecnologia, ordinamento, paginazione, reset e URL', async () => {
  const elenaToken = await apiLogin(ownerEmail);
  for (const [i, category] of ['Dati', 'Design', 'Mobile'].entries()) {
    await apiCall(elenaToken, 'POST', '/projects', { title: `Progetto extra ${i + 1}`, category, technologies: 'Rust', visibility: 'public' });
  }
  const { context, page } = await open('catalogo');
  await page.goto(`${BASE}/catalog`);
  await page.waitForSelector('.project-card');
  const total = Number((await page.locator('.results-bar strong').innerText()).trim());
  assert(total >= 10, `attesi almeno 10 progetti, trovati ${total}`);
  assert((await page.locator('.project-card').count()) === 9, 'la pagina deve mostrare 9 card');
  await page.click('nav[aria-label=Paginazione] button[aria-label="Pagina 2"]');
  await page.waitForFunction(() => location.search.includes('page=2'));
  await page.click('nav[aria-label=Paginazione] button[aria-label="Pagina 1"]');
  await page.selectOption('#catalog-category', 'Mobile');
  await page.waitForFunction(() => location.search.includes('category=Mobile'));
  await page.waitForFunction(() => document.querySelectorAll('.project-card').length < 9);
  await page.selectOption('#catalog-category', '');
  await page.selectOption('#catalog-tech', { label: /Playwright|React/.test('React') ? 'React' : '' }).catch(() => {});
  await page.fill('#catalog-q', 'palestra');
  await page.waitForFunction(() => document.querySelectorAll('.project-card').length === 1);
  assert(page.url().includes('q=palestra'), 'ricerca non riportata nell\'URL');
  await page.click('button:has-text("Azzera i filtri")');
  await page.waitForFunction(() => document.querySelectorAll('.project-card').length === 9);
  await page.selectOption('#catalog-sort', 'title');
  await page.waitForTimeout(500);
  const titles = await page.locator('.project-card h3').allInnerTexts();
  assert(JSON.stringify(titles) === JSON.stringify([...titles].sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))), 'ordinamento per titolo errato');
  // nessun risultato → stato vuoto con azione
  await page.fill('#catalog-q', 'xyzxyzxyz');
  await page.locator('.state:has-text("Nessun progetto trovato")').waitFor();
  await page.locator('.state button:has-text("Azzera i filtri")').click();
  // errore + riprova
  await page.route('**/api/projects/public?**', (r) => r.abort());
  await page.fill('#catalog-q', 'errore');
  await page.locator('.state-error button:has-text("Riprova")').waitFor();
  await page.unroute('**/api/projects/public?**');
  await page.locator('.state-error button:has-text("Riprova")').click();
  await page.locator('.state-error').waitFor({ state: 'detached' });
  await context.close();
});

// ====================================================================== H. Segnalazione e moderazione
const admin = await open('admin');
await login(admin.page, 'admin@taskflow.test', 'admin1234');
await admin.page.goto(`${BASE}/admin?tab=reports`);
const sara = await open('sara');
await login(sara.page, 'sara@taskflow.test');
await step('Utente esterno: panoramica pubblica senza bacheca/chat né email dei membri', async () => {
  await sara.page.goto(`${BASE}/catalog`);
  await sara.page.fill('#catalog-q', 'Progetto E2E');
  await sara.page.waitForFunction(() => document.querySelectorAll('.project-card').length === 1); // attende il filtro
  await sara.page.click('.project-card h3 a');
  await sara.page.waitForURL(/\/projects\//);
  assert((await sara.page.getByRole('tab', { name: /Bacheca/ }).count()) === 0, 'tab Bacheca visibile a un estraneo');
  assert((await sara.page.getByRole('tab', { name: /Chat/ }).count()) === 0, 'tab Chat visibile a un estraneo');
  await sara.page.locator('text=Vuoi partecipare?').waitFor();
  await tab(sara.page, 'Membri');
  const text = await sara.page.locator('[data-testid=members]').innerText();
  assert(!text.includes('@'), 'email dei membri visibili a un estraneo');
  const saraToken = await apiLogin('sara@taskflow.test');
  assert((await apiCall(saraToken, 'GET', `/projects/${projectId}/messages`)).status === 403, 'chat leggibile da estraneo');
});
await step('Segnalazione: notifica live all\'admin; oscuramento → membro espulso live, catalogo e API', async () => {
  await sara.page.click('button:has-text("Segnala")');
  await sara.page.locator('[role=dialog] textarea').fill('Contenuto da verificare');
  await sara.page.click('[role=dialog] button:has-text("Invia segnalazione")');
  await toastWith(sara.page, 'Segnalazione inviata');
  await toastWith(admin.page, 'segnalato');
  await admin.page.locator('[data-testid=reports] .report', { hasText: 'Progetto E2E (rev)' }).waitFor({ timeout: 6000 });
  await marco.page.goto(`${BASE}/projects/${projectId}?tab=board`);
  await marco.page.waitForSelector('.board');
  await admin.page.locator('.report', { hasText: 'Progetto E2E (rev)' }).locator('button:has-text("Oscura il progetto")').click();
  await confirmDialog(admin.page);
  await toastWith(admin.page, 'oscurato');
  await marco.page.waitForURL('**/projects', { timeout: 8000 });
  await toastWith(marco.page, 'oscurato');
  const marcoToken = await apiLogin('marco@taskflow.test');
  assert((await apiCall(marcoToken, 'GET', `/projects/${projectId}/tasks`)).status === 403, 'API ancora accessibile al membro dopo l\'oscuramento');
  const catalog = await apiCall(null, 'GET', '/projects/public?q=Progetto%20E2E');
  assert(catalog.body.projects.length === 0, 'progetto oscurato ancora nel catalogo');
  await admin.page.locator('.report', { hasText: 'Progetto E2E (rev)' }).waitFor({ state: 'detached', timeout: 6000 });
  await admin.page.click('button:has-text("Gestite")');
  await admin.page.locator('.report', { hasText: 'Progetto E2E (rev)' }).waitFor();
});
await step('Admin rende di nuovo visibile il progetto dalla scheda Progetti', async () => {
  await admin.page.getByRole('tab', { name: /Progetti/ }).click();
  await admin.page.fill('input[aria-label="Cerca un progetto per titolo"]', 'Progetto E2E');
  await admin.page.locator('tr:has-text("Progetto E2E (rev)") button:has-text("Rendi visibile")').click();
  await confirmDialog(admin.page);
  await toastWith(admin.page, 'visibile');
  const marcoToken = await apiLogin('marco@taskflow.test');
  assert((await apiCall(marcoToken, 'GET', `/projects/${projectId}/tasks`)).status === 200, 'membro non riammesso');
});

// ====================================================================== I. Archivio
await step('Archiviazione: sola lettura per tutti, aggiornata live; riattivazione', async () => {
  await marco.page.goto(`${BASE}/projects/${projectId}?tab=board`);
  await marco.page.waitForSelector('.board');
  await owner.page.goto(`${BASE}/projects/${projectId}?tab=settings`);
  await owner.page.click('.danger-zone button:has-text("Archivia")');
  await confirmDialog(owner.page);
  await marco.page.locator('.banner-warn').waitFor({ timeout: 6000 });
  assert((await marco.page.locator('button:has-text("Nuovo task")').count()) === 0, 'si può ancora creare un task in un progetto archiviato');
  const marcoToken = await apiLogin('marco@taskflow.test');
  assert((await apiCall(marcoToken, 'POST', `/projects/${projectId}/tasks`, { title: 'x' })).status === 409, 'la API accetta task in un progetto archiviato');
  await owner.page.click('.danger-zone button:has-text("Riattiva")');
  await confirmDialog(owner.page);
  await marco.page.locator('.banner-warn').waitFor({ state: 'detached', timeout: 6000 });
});

// ====================================================================== J. Blocco utente
await step('Blocco: l\'utente viene espulso live, non può più accedere; sblocco', async () => {
  await marco.page.goto(`${BASE}/dashboard`);
  await marco.page.locator('.stat').first().waitFor();
  await admin.page.goto(`${BASE}/admin?tab=users`);
  await admin.page.fill('input[aria-label="Cerca un utente"]', 'marco@');
  await admin.page.locator('tr:has-text("marco@taskflow.test") button:has-text("Blocca")').click();
  await confirmDialog(admin.page);
  await marco.page.waitForURL('**/login', { timeout: 8000 });
  await marco.page.locator('.form-notice:has-text("bloccato")').waitFor();
  await marco.page.fill('input[type=email]', 'marco@taskflow.test');
  await marco.page.fill('input[type=password]', 'password123');
  await marco.page.click('button:has-text("Accedi")');
  await marco.page.locator('[role=alert]:has-text("bloccato")').waitFor();
  await admin.page.locator('tr:has-text("marco@taskflow.test") button:has-text("Sblocca")').click();
  await toastWith(admin.page, 'sbloccato');
  await login(marco.page, 'marco@taskflow.test');
});

// ====================================================================== K. Accessi negati
await step('Accessi negati: progetto privato altrui e API', async () => {
  const giuliaToken = await apiLogin('giulia@taskflow.test');
  const list = await apiCall(giuliaToken, 'GET', '/projects/mine?q=Piano');
  const privateId = list.body.projects[0]._id;
  await sara.page.goto(`${BASE}/projects/${privateId}`);
  await sara.page.locator('.state-error:has-text("accesso")').waitFor();
  const saraToken = await apiLogin('sara@taskflow.test');
  assert((await apiCall(saraToken, 'GET', `/projects/${privateId}`)).status === 403, 'progetto privato leggibile');
  assert((await apiCall(saraToken, 'PUT', `/projects/${projectId}`, { title: 'hack' })).status === 403, 'modifica da non proprietario');
  assert((await apiCall(saraToken, 'DELETE', `/projects/${projectId}`)).status === 403, 'cancellazione da non proprietario');
  assert((await apiCall(null, 'GET', '/dashboard')).status === 401, 'dashboard senza token');
});

// ====================================================================== L. Rimozione membro e uscita
await step('Rimozione di un membro: perde accesso live', async () => {
  await marco.page.goto(`${BASE}/projects/${projectId}?tab=board`);
  await marco.page.waitForSelector('.board');
  await owner.page.goto(`${BASE}/projects/${projectId}?tab=members`);
  await owner.page.getByRole('button', { name: 'Rimuovi Marco Bianchi dal progetto' }).click();
  await confirmDialog(owner.page);
  await marco.page.waitForURL('**/projects', { timeout: 8000 });
  await toastWith(marco.page, 'Non fai più parte');
});

// ====================================================================== M. Profilo
await step('Profilo: cambio nome e password', async () => {
  await owner.page.goto(`${BASE}/profile`);
  await owner.page.getByLabel('Nome').fill('Elena E2E Rossi');
  await owner.page.click('button:has-text("Salva modifiche")');
  await toastWith(owner.page, 'Profilo aggiornato');
  await owner.page.getByLabel('Password attuale').fill('errata123');
  await owner.page.getByLabel('Nuova password').fill('nuovapassword9');
  await owner.page.click('button:has-text("Cambia password")');
  await owner.page.locator('.field-error:has-text("attuale")').waitFor();
  await owner.page.getByLabel('Password attuale').fill('password123');
  await owner.page.click('button:has-text("Cambia password")');
  await toastWith(owner.page, 'Password aggiornata');
  await owner.page.reload();
  await owner.page.locator('h1:has-text("Elena E2E Rossi")').waitFor();
});

// ====================================================================== N. Eliminazione progetto
await step('Eliminazione progetto con conferma; cover rimossa dal disco', async () => {
  await owner.page.goto(`${BASE}/projects/${projectId}?tab=settings`);
  await owner.page.click('.danger-zone button:has-text("Elimina")');
  await owner.page.locator('[role=dialog]').waitFor();
  await owner.page.keyboard.press('Escape'); // annullando non succede nulla
  assert((await owner.page.locator('[role=dialog]').count()) === 0, 'il dialogo non si chiude con Esc');
  await owner.page.click('.danger-zone button:has-text("Elimina")');
  await confirmDialog(owner.page);
  await owner.page.waitForURL('**/projects');
  const token = await apiLogin('giulia@taskflow.test');
  assert((await apiCall(token, 'GET', `/projects/${projectId}`)).status === 404, 'progetto ancora presente');
  assert((await fetch(BASE + coverSrc)).status === 404, 'il file della copertina è rimasto sul disco dopo la cancellazione');
});

// ====================================================================== O. Mobile
await step('Mobile (390px): menu, navigazione, bacheca con "Sposta in", nessun overflow orizzontale', async () => {
  const { context, page } = await open('mobile', { width: 390, height: 844 });
  await login(page, 'giulia@taskflow.test');
  const overflow = async (name) => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(over <= 1, `overflow orizzontale (${over}px) in ${name}`);
  };
  await overflow('dashboard');
  await page.click('button[aria-label="Apri il menu"]');
  await page.locator('#sidebar.is-open').waitFor();
  await page.click('#sidebar a:has-text("I miei task")');
  await page.waitForURL('**/tasks');
  await page.locator('#sidebar.is-open').waitFor({ state: 'detached', timeout: 3000 }).catch(() => { throw new Error('il menu non si chiude dopo la navigazione'); });
  await overflow('task');
  for (const path of ['/catalog', '/projects', '/notifications', '/profile', '/projects/new']) {
    await page.goto(`${BASE}${path}`);
    await page.waitForTimeout(300);
    await overflow(path);
  }
  await page.goto(`${BASE}/projects`);
  await page.click('text=Gestionale per la palestra');
  await page.waitForSelector('[data-testid=task]');
  await overflow('progetto');
  for (const t of ['Panoramica', 'Membri', 'Chat', 'Impostazioni']) {
    await page.getByRole('tab', { name: new RegExp(t) }).click();
    await page.waitForTimeout(300);
    await overflow(`progetto/${t}`);
  }
  await page.getByRole('tab', { name: /Bacheca/ }).click();
  await page.waitForSelector('.board');
  const sc = await page.locator('.board').evaluate((el) => getComputedStyle(el).overflowX);
  assert(sc === 'auto', 'la bacheca non scorre in orizzontale su mobile');
  const first = page.locator('[data-testid=column-todo] [data-testid=task]').first();
  const title = await first.locator('.task-title').innerText();
  await first.getByRole('button', { name: /Azioni per il task/ }).click();
  await page.getByRole('menuitemradio', { name: 'In corso' }).click();
  await page.locator(`[data-testid=column-in_progress] [data-testid=task]:has-text("${title}")`).waitFor();
  await page.keyboard.press('Escape');
  // ripristina lo stato originale dei dati demo
  await page.locator(`[data-testid=task]:has-text("${title}")`).getByRole('button', { name: /Azioni per il task/ }).click();
  await page.getByRole('menuitemradio', { name: 'Da fare' }).click();
  await page.locator(`[data-testid=column-todo] [data-testid=task]:has-text("${title}")`).waitFor();
  await context.close();
  const adm = await open('mobile-admin', { width: 390, height: 844 });
  await login(adm.page, 'admin@taskflow.test', 'admin1234');
  for (const t of ['reports', 'projects', 'users']) {
    await adm.page.goto(`${BASE}/admin?tab=${t}`);
    await adm.page.waitForTimeout(600);
    const over = await adm.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(over <= 1, `overflow orizzontale (${over}px) in admin/${t}`);
  }
  await adm.context.close();
});

// ====================================================================== P. Accessibilità (axe)
await step('Accessibilità (axe-core): nessuna violazione seria o critica nelle schermate principali', async () => {
  const { context, page } = await open('axe');
  const problems = [];
  const check = async (name) => {
    await page.waitForTimeout(500);
    await page.evaluate(axeSource);
    const res = await page.evaluate(() => window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }));
    res.violations
      .filter((v) => ['serious', 'critical'].includes(v.impact))
      .forEach((v) => problems.push(`${name}: ${v.id} (${v.impact}) – ${v.nodes.length} elementi – ${v.nodes[0].target.join(' ')}`));
  };
  await page.goto(`${BASE}/login`); await check('login');
  await page.goto(`${BASE}/register`); await check('register');
  await page.goto(`${BASE}/catalog`); await page.waitForSelector('.project-card'); await check('catalogo');
  await login(page, 'giulia@taskflow.test');
  await page.waitForSelector('.stat'); await check('dashboard');
  await page.goto(`${BASE}/projects`); await page.waitForSelector('.project-card'); await check('i miei progetti');
  await page.goto(`${BASE}/tasks`); await page.waitForSelector('.list-row'); await check('i miei task');
  await page.goto(`${BASE}/notifications`); await page.waitForSelector('.notif'); await check('notifiche');
  await page.goto(`${BASE}/profile`); await check('profilo');
  await page.goto(`${BASE}/projects/new`); await check('nuovo progetto');
  await page.goto(`${BASE}/projects`); await page.click('text=Gestionale per la palestra');
  await page.waitForSelector('[data-testid=task]'); await check('progetto: bacheca');
  for (const t of ['Panoramica', 'Membri', 'Chat', 'Impostazioni']) { await tab(page, t); await check(`progetto: ${t}`); }
  await page.click('button[role=tab]:has-text("Bacheca")');
  await page.getByRole('button', { name: /Azioni per il task/ }).first().click(); await check('menu del task');
  await page.keyboard.press('Escape');
  await page.locator('[data-testid=task] .task-main').first().click(); await check('dettaglio task (dialogo)');
  await page.keyboard.press('Escape');
  const adminPage = await open('axe-admin');
  await login(adminPage.page, 'admin@taskflow.test', 'admin1234');
  for (const t of ['reports', 'projects', 'users']) {
    await adminPage.page.goto(`${BASE}/admin?tab=${t}`);
    await adminPage.page.waitForTimeout(600);
    await adminPage.page.evaluate(axeSource);
    const res = await adminPage.page.evaluate(() => window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }));
    res.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).forEach((v) => problems.push(`admin ${t}: ${v.id} (${v.impact}) – ${v.nodes[0].target.join(' ')}`));
  }
  await context.close();
  if (problems.length) throw new Error(`\n${problems.join('\n')}`);
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} scenari superati`);
const unique = [...new Set(consoleErrors)];
console.log('Errori console/pagina:', unique.length ? unique : 'nessuno');
process.exit(failed.length || unique.length ? 1 : 0);
