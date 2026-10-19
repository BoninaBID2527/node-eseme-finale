const http = require('http');
const { io: connectClient } = require('socket.io-client');
const initSockets = require('../src/sockets');
const { app, request, connect, disconnect, createUser, createProject, addMember, authed } = require('./helpers');

let server, io, url, owner, member, admin, project;
const clients = [];

// Connette un client Socket.IO con il token e aspetta la connessione.
function socketFor(token) {
  const socket = connectClient(url, { auth: { token }, transports: ['websocket'], reconnection: false });
  clients.push(socket);
  return new Promise((resolve, reject) => {
    socket.on('connect', () => setTimeout(() => resolve(socket), 150)); // lascia il tempo di entrare nelle room
    socket.on('connect_error', reject);
  });
}

const waitFor = (socket, event, ms = 3000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout in attesa di "${event}"`)), ms);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

// Verifica che un evento NON arrivi entro un breve intervallo.
const neverReceives = (socket, event, ms = 400) =>
  new Promise((resolve, reject) => {
    const handler = () => reject(new Error(`ricevuto "${event}" che non doveva arrivare`));
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, ms);
  });

beforeAll(async () => {
  await connect();
  server = http.createServer(app);
  io = initSockets(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;

  owner = await createUser('Owner');
  member = await createUser('Member');
  admin = await createUser('Admin', { admin: true });
  project = await createProject(owner.token);
  await addMember(owner, project, member);
});

afterAll(async () => {
  clients.forEach((c) => c.close());
  await io.close();
  await disconnect();
});

describe('Tempo reale', () => {
  test('connessione senza token valido rifiutata', async () => {
    await expect(socketFor('token-falso')).rejects.toBeDefined();
  });

  test('la bacheca si aggiorna live e l\'assegnatario riceve la notifica', async () => {
    const memberSocket = await socketFor(member.token);
    const created = waitFor(memberSocket, 'task:created');
    const notification = waitFor(memberSocket, 'notification:new');

    await request(app).post(`/api/projects/${project._id}/tasks`).set(authed(owner.token)).send({ title: 'Task live', assignee: member.user._id });

    expect((await created).title).toBe('Task live');
    expect((await notification).type).toBe('task_assigned');
  });

  test('spostamento, riassegnazione, eliminazione e chat arrivano ai membri', async () => {
    const tasks = await request(app).get(`/api/projects/${project._id}/tasks`).set(authed(owner.token));
    const id = tasks.body.tasks[0]._id;
    const memberSocket = await socketFor(member.token);

    const moved = waitFor(memberSocket, 'task:moved');
    await request(app).patch(`/api/projects/${project._id}/tasks/${id}/status`).set(authed(owner.token)).send({ status: 'done' });
    expect((await moved).status).toBe('done');

    const updated = waitFor(memberSocket, 'task:updated');
    await request(app).patch(`/api/projects/${project._id}/tasks/${id}/assignee`).set(authed(owner.token)).send({ assignee: null });
    expect((await updated).assignee).toBeNull();

    const deleted = waitFor(memberSocket, 'task:deleted');
    await request(app).delete(`/api/projects/${project._id}/tasks/${id}`).set(authed(owner.token));
    expect((await deleted)._id).toBe(id);

    const message = waitFor(memberSocket, 'chat:message');
    await request(app).post(`/api/projects/${project._id}/messages`).set(authed(owner.token)).send({ text: 'Ciao!' });
    expect((await message).text).toBe('Ciao!');
  });

  test('l\'invito arriva live; accettandolo il nuovo membro entra nella room e gli altri vengono avvisati', async () => {
    const newcomer = await createUser('Newcomer');
    const newcomerSocket = await socketFor(newcomer.token);
    const ownerSocket = await socketFor(owner.token);

    const invited = waitFor(newcomerSocket, 'invitation:created');
    const inviteNotif = waitFor(newcomerSocket, 'notification:new');
    const res = await request(app).post(`/api/projects/${project._id}/invitations`).set(authed(owner.token)).send({ email: newcomer.email });
    expect((await invited).project.title).toBe('Progetto');
    expect((await inviteNotif).type).toBe('project_invitation');

    // Finché non accetta non riceve gli eventi del progetto
    const early = neverReceives(newcomerSocket, 'chat:message');
    await request(app).post(`/api/projects/${project._id}/messages`).set(authed(owner.token)).send({ text: 'Prima dell\'ingresso' });
    await early;

    const joined = waitFor(ownerSocket, 'member:joined');
    await request(app).post(`/api/invitations/${res.body.invitation._id}/accept`).set(authed(newcomer.token));
    expect((await joined).user.name).toBe('Newcomer');

    const message = waitFor(newcomerSocket, 'chat:message');
    await request(app).post(`/api/projects/${project._id}/messages`).set(authed(owner.token)).send({ text: 'Benvenuto' });
    expect((await message).text).toBe('Benvenuto');
  });

  test('commenti e cronologia arrivano ai membri in tempo reale', async () => {
    const created = await request(app).post(`/api/projects/${project._id}/tasks`).set(authed(owner.token)).send({ title: 'Da commentare' });
    const taskId = created.body.task._id;
    const memberSocket = await socketFor(member.token);

    const comment = waitFor(memberSocket, 'comment:created');
    const activity = waitFor(memberSocket, 'activity:new');
    await request(app).post(`/api/projects/${project._id}/tasks/${taskId}/comments`).set(authed(owner.token)).send({ text: 'Commento live' });
    const c = await comment;
    expect(c.text).toBe('Commento live');
    expect(c.task).toBe(taskId);
    expect((await activity).type).toBe('comment_added');

    const removed = waitFor(memberSocket, 'comment:deleted');
    await request(app).delete(`/api/projects/${project._id}/tasks/${taskId}/comments/${c._id}`).set(authed(owner.token));
    expect((await removed)._id).toBe(c._id);
  });

  test('un membro rimosso smette di ricevere gli eventi live del progetto', async () => {
    const removed = await createUser('Removed');
    await addMember(owner, project, removed);
    const removedSocket = await socketFor(removed.token);

    const notice = waitFor(removedSocket, 'member:removed');
    await request(app).delete(`/api/projects/${project._id}/members/${removed.user._id}`).set(authed(owner.token));
    expect((await notice).userId).toBe(removed.user._id);

    const silent = neverReceives(removedSocket, 'chat:message');
    await request(app).post(`/api/projects/${project._id}/messages`).set(authed(owner.token)).send({ text: 'Riservato' });
    await silent;
  });

  test('un utente bloccato viene disconnesso subito', async () => {
    const victim = await createUser('Victim');
    const socket = await socketFor(victim.token);
    const ended = waitFor(socket, 'session:ended');
    const disconnected = waitFor(socket, 'disconnect');

    await request(app).patch(`/api/admin/users/${victim.user._id}/block`).set(authed(admin.token)).send({});
    expect((await ended).reason).toBe('blocked');
    await disconnected;
    await expect(socketFor(victim.token)).rejects.toBeDefined();
  });

  test('il logout chiude la connessione live di quel token', async () => {
    const user = await createUser('Leaver');
    const socket = await socketFor(user.token);
    const ended = waitFor(socket, 'session:ended');
    await request(app).post('/api/auth/logout').set(authed(user.token));
    expect((await ended).reason).toBe('logout');
  });

  test('oscurare un progetto toglie i membri dalla room ma non il proprietario; riattivandolo rientrano', async () => {
    const p = await createProject(owner.token, { title: 'Da oscurare' });
    await addMember(owner, p, member);
    const memberSocket = await socketFor(member.token);
    await socketFor(owner.token);
    const roomUsers = async () => [...new Set((await io.in(`project:${p._id}`).fetchSockets()).map((s) => s.data.userId))].sort();

    expect(await roomUsers()).toEqual([owner.user._id, member.user._id].sort());

    const hiddenEvent = waitFor(memberSocket, 'project:updated');
    await request(app).patch(`/api/admin/projects/${p._id}/hide`).set(authed(admin.token)).send({});
    expect((await hiddenEvent).status).toBe('hidden');
    expect(await roomUsers()).toEqual([owner.user._id]);

    const visibleEvent = waitFor(memberSocket, 'project:updated');
    await request(app).patch(`/api/admin/projects/${p._id}/hide`).set(authed(admin.token)).send({ hidden: false });
    expect((await visibleEvent).status).toBe('active');
    expect(await roomUsers()).toEqual([owner.user._id, member.user._id].sort());

    const taskEvent = waitFor(memberSocket, 'task:created');
    await request(app).post(`/api/projects/${p._id}/tasks`).set(authed(owner.token)).send({ title: 'Dopo il ripristino' });
    expect((await taskEvent).title).toBe('Dopo il ripristino');
  });

  test('l\'eliminazione di un progetto avvisa i membri connessi', async () => {
    const p = await createProject(owner.token, { title: 'Da eliminare' });
    await addMember(owner, p, member);
    const memberSocket = await socketFor(member.token);
    const gone = waitFor(memberSocket, 'project:deleted');
    await request(app).delete(`/api/projects/${p._id}`).set(authed(owner.token));
    expect((await gone).projectId).toBe(p._id);
  });

  test('l\'admin riceve la notifica live di un progetto segnalato', async () => {
    const adminSocket = await socketFor(admin.token);
    const reporter = await createUser('Reporter');

    const notification = waitFor(adminSocket, 'notification:new');
    await request(app).post(`/api/projects/${project._id}/report`).set(authed(reporter.token)).send({ reason: 'Spam evidente' });
    expect((await notification).type).toBe('project_reported');
  });
});
