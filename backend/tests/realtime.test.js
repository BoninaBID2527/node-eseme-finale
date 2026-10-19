const http = require('http');
const { io: connectClient } = require('socket.io-client');
const initSockets = require('../src/sockets');
const { app, request, connect, disconnect, createUser, createProject, authed } = require('./helpers');

let server, io, url, owner, member, admin, project;
const clients = [];

// Connette un client Socket.IO con il token e aspetta la connessione.
function socketFor(token) {
  const socket = connectClient(url, { auth: { token }, transports: ['websocket'] });
  clients.push(socket);
  return new Promise((resolve, reject) => {
    socket.on('connect', () => setTimeout(() => resolve(socket), 100)); // lascia il tempo di entrare nelle room
    socket.on('connect_error', reject);
  });
}

const waitFor = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

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
  await request(app).post(`/api/projects/${project._id}/members`).set(authed(owner.token)).send({ email: member.email });
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

    await request(app)
      .post(`/api/projects/${project._id}/tasks`)
      .set(authed(owner.token))
      .send({ title: 'Task live', assignee: member.user._id });

    expect((await created).title).toBe('Task live');
    expect((await notification).type).toBe('task_assigned');
  });

  test('spostamento task e messaggi di chat arrivano ai membri', async () => {
    const tasks = await request(app).get(`/api/projects/${project._id}/tasks`).set(authed(owner.token));
    const memberSocket = await socketFor(member.token);

    const moved = waitFor(memberSocket, 'task:moved');
    await request(app)
      .patch(`/api/projects/${project._id}/tasks/${tasks.body.tasks[0]._id}/status`)
      .set(authed(owner.token))
      .send({ status: 'done' });
    expect((await moved).status).toBe('done');

    const message = waitFor(memberSocket, 'chat:message');
    await request(app).post(`/api/projects/${project._id}/messages`).set(authed(owner.token)).send({ text: 'Ciao!' });
    expect((await message).text).toBe('Ciao!');
  });

  test('un nuovo membro entra nella room subito e gli altri vengono avvisati', async () => {
    const newcomer = await createUser('Newcomer');
    const newcomerSocket = await socketFor(newcomer.token);
    const ownerSocket = await socketFor(owner.token);

    const joined = waitFor(ownerSocket, 'member:joined');
    const welcome = waitFor(newcomerSocket, 'notification:new');
    await request(app).post(`/api/projects/${project._id}/members`).set(authed(owner.token)).send({ email: newcomer.email });
    expect((await joined).user.name).toBe('Newcomer');
    expect((await welcome).type).toBe('member_joined');

    // Dopo l'ingresso il nuovo membro riceve anche gli eventi del progetto.
    const message = waitFor(newcomerSocket, 'chat:message');
    await request(app).post(`/api/projects/${project._id}/messages`).set(authed(owner.token)).send({ text: 'Benvenuto' });
    expect((await message).text).toBe('Benvenuto');
  });

  test('l\'admin riceve la notifica live di un progetto segnalato', async () => {
    const adminSocket = await socketFor(admin.token);
    const reporter = await createUser('Reporter');

    const notification = waitFor(adminSocket, 'notification:new');
    await request(app).post(`/api/projects/${project._id}/report`).set(authed(reporter.token)).send({ reason: 'Spam' });
    expect((await notification).type).toBe('project_reported');
  });
});
