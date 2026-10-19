const { app, request, connect, disconnect, createUser, createProject, authed } = require('./helpers');

let owner, member, stranger, project;
const base = () => `/api/projects/${project._id}`;

beforeAll(async () => {
  await connect();
  owner = await createUser('Owner');
  member = await createUser('Member');
  stranger = await createUser('Stranger');
  project = await createProject(owner.token);
  await request(app).post(`${base()}/members`).set(authed(owner.token)).send({ email: member.email });
});
afterAll(disconnect);

describe('Task, bacheca e notifiche', () => {
  let task;

  test('un estraneo non può vedere né creare task', async () => {
    expect((await request(app).get(`${base()}/tasks`).set(authed(stranger.token))).status).toBe(403);
    const res = await request(app).post(`${base()}/tasks`).set(authed(stranger.token)).send({ title: 'X' });
    expect(res.status).toBe(403);
  });

  test('creazione task con assegnatario → notifica all\'assegnatario', async () => {
    const res = await request(app)
      .post(`${base()}/tasks`)
      .set(authed(owner.token))
      .send({ title: 'Primo task', priority: 'high', dueDate: '2030-01-10', assignee: member.user._id });
    expect(res.status).toBe(201);
    expect(res.body.task.status).toBe('todo');
    expect(res.body.task.assignee.name).toBe('Member');
    task = res.body.task;

    const notifs = await request(app).get('/api/notifications').set(authed(member.token));
    expect(notifs.body.unread).toBeGreaterThanOrEqual(1);
    expect(notifs.body.notifications.some((n) => n.type === 'task_assigned')).toBe(true);
  });

  test('dati non validi → 400; assegnatario fuori dal progetto → 400', async () => {
    const noTitle = await request(app).post(`${base()}/tasks`).set(authed(owner.token)).send({});
    expect(noTitle.status).toBe(400);
    const badPriority = await request(app).post(`${base()}/tasks`).set(authed(owner.token)).send({ title: 'x', priority: 'urgente' });
    expect(badPriority.status).toBe(400);
    const outsider = await request(app)
      .post(`${base()}/tasks`)
      .set(authed(owner.token))
      .send({ title: 'x', assignee: stranger.user._id });
    expect(outsider.status).toBe(400);
  });

  test('spostamento di colonna e notifica di cambio stato', async () => {
    const res = await request(app).patch(`${base()}/tasks/${task._id}/status`).set(authed(owner.token)).send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('in_progress');

    const notifs = await request(app).get('/api/notifications').set(authed(member.token));
    expect(notifs.body.notifications.some((n) => n.type === 'task_moved')).toBe(true);

    const bad = await request(app).patch(`${base()}/tasks/${task._id}/status`).set(authed(owner.token)).send({ status: 'boh' });
    expect(bad.status).toBe(400);
  });

  test('riassegnazione ad un altro membro', async () => {
    const res = await request(app)
      .patch(`${base()}/tasks/${task._id}/assignee`)
      .set(authed(member.token))
      .send({ assignee: owner.user._id });
    expect(res.status).toBe(200);
    expect(res.body.task.assignee.name).toBe('Owner');
  });

  test('task inesistente → 404', async () => {
    const res = await request(app).put(`${base()}/tasks/64b7f0f4f4f4f4f4f4f4f4f4`).set(authed(owner.token)).send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  test('dashboard: progetti creati, membro e task ordinati per scadenza', async () => {
    await request(app).post(`${base()}/tasks`).set(authed(owner.token)).send({ title: 'Senza scadenza', assignee: member.user._id });
    await request(app).post(`${base()}/tasks`).set(authed(owner.token)).send({ title: 'Tardi', dueDate: '2031-01-01', assignee: member.user._id });
    await request(app).post(`${base()}/tasks`).set(authed(owner.token)).send({ title: 'Presto', dueDate: '2030-01-01', assignee: member.user._id });

    const dash = await request(app).get('/api/dashboard').set(authed(member.token));
    expect(dash.status).toBe(200);
    expect(dash.body.memberOf).toHaveLength(1);
    expect(dash.body.created).toHaveLength(0);
    expect(dash.body.tasks.map((t) => t.title)).toEqual(['Presto', 'Tardi', 'Senza scadenza']);

    const ownerDash = await request(app).get('/api/dashboard').set(authed(owner.token));
    expect(ownerDash.body.created).toHaveLength(1);
  });

  test('segnare le notifiche come lette', async () => {
    const list = await request(app).get('/api/notifications').set(authed(member.token));
    const one = list.body.notifications[0];
    const res = await request(app).patch(`/api/notifications/${one._id}/read`).set(authed(member.token));
    expect(res.body.notification.read).toBe(true);
    // Un altro utente non può toccare la notifica.
    expect((await request(app).patch(`/api/notifications/${one._id}/read`).set(authed(owner.token))).status).toBe(404);
    await request(app).patch('/api/notifications/read-all').set(authed(member.token));
    expect((await request(app).get('/api/notifications').set(authed(member.token))).body.unread).toBe(0);
  });

  test('rimuovere un membro libera i suoi task', async () => {
    await request(app).delete(`${base()}/members/${member.user._id}`).set(authed(owner.token));
    const tasks = await request(app).get(`${base()}/tasks`).set(authed(owner.token));
    expect(tasks.body.tasks.every((t) => !t.assignee || t.assignee.name !== 'Member')).toBe(true);
    expect((await request(app).get(`${base()}/tasks`).set(authed(member.token))).status).toBe(403);
  });

  test('progetto archiviato: i task non si modificano', async () => {
    await request(app).patch(`${base()}/archive`).set(authed(owner.token)).send({});
    const res = await request(app).post(`${base()}/tasks`).set(authed(owner.token)).send({ title: 'Tardi' });
    expect(res.status).toBe(400);
  });
});

describe('Chat', () => {
  let chatProject;
  beforeAll(async () => {
    chatProject = await createProject(owner.token, { title: 'Chat' });
    await request(app).post(`/api/projects/${chatProject._id}/members`).set(authed(owner.token)).send({ email: member.email });
  });

  test('i membri scrivono e leggono, gli estranei no', async () => {
    const url = `/api/projects/${chatProject._id}/messages`;
    expect((await request(app).post(url).set(authed(member.token)).send({ text: 'Ciao a tutti' })).status).toBe(201);
    expect((await request(app).post(url).set(authed(member.token)).send({ text: '  ' })).status).toBe(400);

    const list = await request(app).get(url).set(authed(owner.token));
    expect(list.body.messages).toHaveLength(1);
    expect(list.body.messages[0].author.name).toBe('Member');

    expect((await request(app).get(url).set(authed(stranger.token))).status).toBe(403);
    expect((await request(app).post(url).set(authed(stranger.token)).send({ text: 'ciao' })).status).toBe(403);
  });
});
