const { app, request, connect, disconnect, createUser, createProject, addMember, authed } = require('./helpers');

let owner, member, stranger, project;
const base = () => `/api/projects/${project._id}`;

beforeAll(async () => {
  await connect();
  owner = await createUser('Owner');
  member = await createUser('Member');
  stranger = await createUser('Stranger');
  project = await createProject(owner.token);
  await addMember(owner, project, member);
});
afterAll(disconnect);

describe('Task, bacheca e notifiche', () => {
  let task;

  test('un estraneo non può vedere né creare task', async () => {
    expect((await request(app).get(`${base()}/tasks`).set(authed(stranger.token))).status).toBe(403);
    expect((await request(app).post(`${base()}/tasks`).set(authed(stranger.token)).send({ title: 'X' })).status).toBe(403);
  });

  test('creazione task con assegnatario → notifica collegata al task', async () => {
    const res = await request(app)
      .post(`${base()}/tasks`)
      .set(authed(owner.token))
      .send({ title: 'Primo task', description: 'Dettagli', priority: 'high', dueDate: '2030-01-10', assignee: member.user._id });
    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({ title: 'Primo task', status: 'todo', priority: 'high' });
    expect(res.body.task.assignee.name).toBe('Member');
    task = res.body.task;

    const notifs = await request(app).get('/api/notifications').set(authed(member.token));
    const assigned = notifs.body.notifications.find((n) => n.type === 'task_assigned');
    expect(assigned.task).toBe(task._id);
    expect(assigned.project).toBe(project._id);
  });

  test('dati non validi → 400 con errori per campo; assegnatario fuori dal progetto → 400', async () => {
    const bad = await request(app).post(`${base()}/tasks`).set(authed(owner.token)).send({ priority: 'urgente', dueDate: 'ieri' });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.errors).sort()).toEqual(['dueDate', 'priority', 'title']);
    const outsider = await request(app).post(`${base()}/tasks`).set(authed(owner.token)).send({ title: 'x', assignee: stranger.user._id });
    expect(outsider.status).toBe(400);
    expect(outsider.body.errors.assignee).toBeDefined();
  });

  test('modifica completa di un task', async () => {
    const res = await request(app).put(`${base()}/tasks/${task._id}`).set(authed(member.token)).send({ title: 'Primo task (rivisto)', priority: 'low', dueDate: '' });
    expect(res.status).toBe(200);
    expect(res.body.task.title).toBe('Primo task (rivisto)');
    expect(res.body.task.dueDate).toBeUndefined();
  });

  test('spostamento di colonna e notifica di cambio stato', async () => {
    const res = await request(app).patch(`${base()}/tasks/${task._id}/status`).set(authed(owner.token)).send({ status: 'in_progress' });
    expect(res.body.task.status).toBe('in_progress');
    const notifs = await request(app).get('/api/notifications').set(authed(member.token));
    expect(notifs.body.notifications.some((n) => n.type === 'task_moved')).toBe(true);
    expect((await request(app).patch(`${base()}/tasks/${task._id}/status`).set(authed(owner.token)).send({ status: 'boh' })).status).toBe(400);
  });

  test('riassegnazione ad un altro membro o a nessuno', async () => {
    const res = await request(app).patch(`${base()}/tasks/${task._id}/assignee`).set(authed(member.token)).send({ assignee: owner.user._id });
    expect(res.body.task.assignee.name).toBe('Owner');
    const none = await request(app).patch(`${base()}/tasks/${task._id}/assignee`).set(authed(member.token)).send({ assignee: null });
    expect(none.body.task.assignee).toBeNull();
    expect((await request(app).patch(`${base()}/tasks/${task._id}/assignee`).set(authed(member.token)).send({})).status).toBe(400);
  });

  test('task inesistente → 404, id malformato → 400', async () => {
    expect((await request(app).put(`${base()}/tasks/64b7f0f4f4f4f4f4f4f4f4f4`).set(authed(owner.token)).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).put(`${base()}/tasks/abc`).set(authed(owner.token)).send({ title: 'x' })).status).toBe(400);
  });

  test('"I miei task": ordinati per scadenza, con filtri e paginazione', async () => {
    const make = (title, extra) => request(app).post(`${base()}/tasks`).set(authed(owner.token)).send({ title, assignee: member.user._id, ...extra });
    await make('Senza scadenza');
    await make('Tardi', { dueDate: '2031-01-01' });
    await make('Presto', { dueDate: '2030-01-01' });
    await make('Scaduto', { dueDate: '2020-01-01' });
    await make('Già fatto', { dueDate: '2020-02-01', status: 'done' });

    const all = await request(app).get('/api/tasks/mine').set(authed(member.token));
    expect(all.body.tasks.map((t) => t.title)).toEqual(['Scaduto', 'Presto', 'Tardi', 'Senza scadenza']);
    expect(all.body.tasks[0].project.title).toBe('Progetto');

    const overdue = await request(app).get('/api/tasks/mine?due=overdue').set(authed(member.token));
    expect(overdue.body.tasks.map((t) => t.title)).toEqual(['Scaduto']);
    const done = await request(app).get('/api/tasks/mine?status=done').set(authed(member.token));
    expect(done.body.tasks.map((t) => t.title)).toEqual(['Già fatto']);
    const noDue = await request(app).get('/api/tasks/mine?due=none').set(authed(member.token));
    expect(noDue.body.tasks.map((t) => t.title)).toEqual(['Senza scadenza']);

    const page = await request(app).get('/api/tasks/mine?limit=2&page=2').set(authed(member.token));
    expect(page.body.tasks.map((t) => t.title)).toEqual(['Tardi', 'Senza scadenza']);
    expect(page.body.total).toBe(4);
    expect((await request(app).get('/api/tasks/mine?due=boh').set(authed(member.token))).status).toBe(400);
  });

  test('dashboard: numeri reali, scaduti separati dalle prossime scadenze, inviti', async () => {
    const dash = await request(app).get('/api/dashboard').set(authed(member.token));
    expect(dash.status).toBe(200);
    expect(dash.body.stats).toMatchObject({ created: 0, memberOf: 1, openTasks: 4, overdue: 1, pendingInvitations: 0 });
    expect(dash.body.overdue.map((t) => t.title)).toEqual(['Scaduto']);
    expect(dash.body.upcoming.map((t) => t.title)).toEqual(['Presto', 'Tardi']);
    expect(dash.body.recentProjects[0].progress.total).toBeGreaterThan(0);

    const ownerDash = await request(app).get('/api/dashboard').set(authed(owner.token));
    expect(ownerDash.body.stats.created).toBe(1);
  });

  test('statistiche del progetto per i membri', async () => {
    const res = await request(app).get(base()).set(authed(member.token));
    expect(res.body.stats.total).toBe(6);
    expect(res.body.stats.done).toBe(1);
    expect(res.body.stats.overdue).toBe(1);
  });

  test('notifiche: paginazione, filtro non lette, conteggio e segna come lette', async () => {
    const list = await request(app).get('/api/notifications?limit=2').set(authed(member.token));
    expect(list.body.notifications).toHaveLength(2);
    expect(list.body.total).toBeGreaterThan(2);
    const count = await request(app).get('/api/notifications/unread-count').set(authed(member.token));
    expect(count.body.unread).toBe(list.body.unread);

    const one = list.body.notifications[0];
    expect((await request(app).patch(`/api/notifications/${one._id}/read`).set(authed(member.token))).body.notification.read).toBe(true);
    expect((await request(app).patch(`/api/notifications/${one._id}/read`).set(authed(owner.token))).status).toBe(404);
    expect((await request(app).get('/api/notifications/unread-count').set(authed(member.token))).body.unread).toBe(count.body.unread - 1);

    await request(app).patch('/api/notifications/read-all').set(authed(member.token));
    expect((await request(app).get('/api/notifications?unread=true').set(authed(member.token))).body.total).toBe(0);
  });

  test('rimuovere un membro libera i suoi task', async () => {
    await request(app).delete(`${base()}/members/${member.user._id}`).set(authed(owner.token));
    const tasks = await request(app).get(`${base()}/tasks`).set(authed(owner.token));
    expect(tasks.body.tasks.every((t) => !t.assignee || t.assignee.name !== 'Member')).toBe(true);
    expect((await request(app).get('/api/tasks/mine').set(authed(member.token))).body.total).toBe(0);
  });

  test('eliminazione di un task', async () => {
    const tasks = await request(app).get(`${base()}/tasks`).set(authed(owner.token));
    const id = tasks.body.tasks[0]._id;
    expect((await request(app).delete(`${base()}/tasks/${id}`).set(authed(owner.token))).status).toBe(200);
    expect((await request(app).delete(`${base()}/tasks/${id}`).set(authed(owner.token))).status).toBe(404);
  });
});

describe('Chat', () => {
  let chatProject;
  const url = () => `/api/projects/${chatProject._id}/messages`;

  beforeAll(async () => {
    chatProject = await createProject(owner.token, { title: 'Chat' });
    await addMember(owner, chatProject, member);
  });

  test('i membri scrivono e leggono, gli estranei no', async () => {
    expect((await request(app).post(url()).set(authed(member.token)).send({ text: 'Ciao a tutti' })).status).toBe(201);
    const empty = await request(app).post(url()).set(authed(member.token)).send({ text: '  ' });
    expect(empty.status).toBe(400);
    expect(empty.body.errors.text).toBeDefined();

    const list = await request(app).get(url()).set(authed(owner.token));
    expect(list.body.messages).toHaveLength(1);
    expect(list.body.messages[0].author.name).toBe('Member');
    expect(list.body.messages[0].createdAt).toBeDefined();

    expect((await request(app).get(url()).set(authed(stranger.token))).status).toBe(403);
    expect((await request(app).post(url()).set(authed(stranger.token)).send({ text: 'ciao' })).status).toBe(403);
  });

  test('cronologia a pagine con cursore', async () => {
    for (let i = 1; i <= 5; i += 1) await request(app).post(url()).set(authed(owner.token)).send({ text: `msg ${i}` });
    const first = await request(app).get(`${url()}?limit=3`).set(authed(owner.token));
    expect(first.body.messages.map((m) => m.text)).toEqual(['msg 3', 'msg 4', 'msg 5']);
    expect(first.body.hasMore).toBe(true);

    const second = await request(app).get(`${url()}?limit=3&before=${first.body.messages[0]._id}`).set(authed(owner.token));
    expect(second.body.messages.map((m) => m.text)).toEqual(['Ciao a tutti', 'msg 1', 'msg 2']);
    expect(second.body.hasMore).toBe(false);
    expect((await request(app).get(`${url()}?before=zzz`).set(authed(owner.token))).status).toBe(400);
  });
});
