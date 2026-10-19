const { app, request, connect, disconnect, createUser, createProject, addMember, authed } = require('./helpers');

let owner, member, stranger, project, task;
const base = () => `/api/projects/${project._id}`;
const commentsUrl = () => `${base()}/tasks/${task._id}/comments`;

beforeAll(async () => {
  await connect();
  owner = await createUser('Owner');
  member = await createUser('Member');
  stranger = await createUser('Stranger');
  project = await createProject(owner.token);
  await addMember(owner, project, member);
  const res = await request(app)
    .post(`${base()}/tasks`)
    .set(authed(owner.token))
    .send({ title: 'Task da commentare', assignee: member.user._id });
  task = res.body.task;
});
afterAll(disconnect);

describe('Commenti sui task', () => {
  let comment;

  test('solo i membri leggono e scrivono; il testo è obbligatorio', async () => {
    expect((await request(app).get(commentsUrl()).set(authed(stranger.token))).status).toBe(403);
    expect((await request(app).post(commentsUrl()).set(authed(stranger.token)).send({ text: 'ciao' })).status).toBe(403);
    expect((await request(app).get(commentsUrl())).status).toBe(401);

    const empty = await request(app).post(commentsUrl()).set(authed(owner.token)).send({ text: '  ' });
    expect(empty.status).toBe(400);
    expect(empty.body.errors.text).toBeDefined();
    const long = await request(app).post(commentsUrl()).set(authed(owner.token)).send({ text: 'x'.repeat(1001) });
    expect(long.status).toBe(400);
  });

  test('un commento viene salvato con autore e data, e avvisa assegnatario e autore del task', async () => {
    const res = await request(app).post(commentsUrl()).set(authed(member.token)).send({ text: 'Ci lavoro oggi' });
    expect(res.status).toBe(201);
    expect(res.body.comment.author.name).toBe('Member');
    expect(res.body.comment.createdAt).toBeDefined();
    comment = res.body.comment;

    // L'autore del task (Owner) è avvisato; chi ha scritto (Member) no.
    const ownerNotifs = await request(app).get('/api/notifications').set(authed(owner.token));
    const n = ownerNotifs.body.notifications.find((x) => x.type === 'task_comment');
    expect(n.task).toBe(task._id);
    expect(n.project).toBe(project._id);
    const memberNotifs = await request(app).get('/api/notifications').set(authed(member.token));
    expect(memberNotifs.body.notifications.some((x) => x.type === 'task_comment')).toBe(false);
  });

  test('elenco con cursore e conteggio nella lista dei task', async () => {
    for (let i = 1; i <= 4; i += 1) await request(app).post(commentsUrl()).set(authed(owner.token)).send({ text: `risposta ${i}` });
    const page1 = await request(app).get(`${commentsUrl()}?limit=3`).set(authed(member.token));
    expect(page1.body.comments.map((c) => c.text)).toEqual(['risposta 2', 'risposta 3', 'risposta 4']);
    expect(page1.body.hasMore).toBe(true);
    const page2 = await request(app).get(`${commentsUrl()}?limit=3&before=${page1.body.comments[0]._id}`).set(authed(member.token));
    expect(page2.body.comments.map((c) => c.text)).toEqual(['Ci lavoro oggi', 'risposta 1']);
    expect(page2.body.hasMore).toBe(false);
    expect((await request(app).get(`${commentsUrl()}?before=zzz`).set(authed(member.token))).status).toBe(400);

    const tasks = await request(app).get(`${base()}/tasks`).set(authed(member.token));
    expect(tasks.body.tasks.find((t) => t._id === task._id).commentCount).toBe(5);
  });

  test('eliminazione: solo l\'autore o il proprietario del progetto', async () => {
    const del = (c, token) => request(app).delete(`${commentsUrl()}/${c._id}`).set(authed(token));
    expect((await del(comment, stranger.token)).status).toBe(403);
    const other = await request(app).post(commentsUrl()).set(authed(owner.token)).send({ text: 'del proprietario' });
    expect((await del(other.body.comment, member.token)).status).toBe(403); // un membro non cancella i commenti altrui
    expect((await del(comment, member.token)).status).toBe(200); // l'autore sì
    expect((await del(other.body.comment, owner.token)).status).toBe(200);
    expect((await del(comment, owner.token)).status).toBe(404);
    // il proprietario può moderare anche i commenti dei membri
    const mine = await request(app).post(commentsUrl()).set(authed(member.token)).send({ text: 'moderami' });
    expect((await del(mine.body.comment, owner.token)).status).toBe(200);
  });

  test('task inesistente o id malformato', async () => {
    expect((await request(app).get(`${base()}/tasks/64b7f0f4f4f4f4f4f4f4f4f4/comments`).set(authed(owner.token))).status).toBe(404);
    expect((await request(app).get(`${base()}/tasks/abc/comments`).set(authed(owner.token))).status).toBe(400);
  });

  test('progetto archiviato: si leggono ma non si scrivono commenti', async () => {
    await request(app).patch(`${base()}/archive`).set(authed(owner.token)).send({});
    expect((await request(app).get(commentsUrl()).set(authed(member.token))).status).toBe(200);
    expect((await request(app).post(commentsUrl()).set(authed(member.token)).send({ text: 'no' })).status).toBe(409);
    await request(app).patch(`${base()}/archive`).set(authed(owner.token)).send({ archived: false });
  });

  test('eliminando il task si eliminano anche i suoi commenti', async () => {
    const Comment = require('../src/models/TaskComment');
    expect(await Comment.countDocuments({ task: task._id })).toBeGreaterThan(0);
    await request(app).delete(`${base()}/tasks/${task._id}`).set(authed(owner.token));
    expect(await Comment.countDocuments({ task: task._id })).toBe(0);
  });
});

describe('Etichette dei task', () => {
  test('si salvano (anche da stringa), senza doppioni, e si modificano', async () => {
    const res = await request(app).post(`${base()}/tasks`).set(authed(owner.token)).send({ title: 'Con etichette', labels: 'bug, UI, ui, urgente' });
    expect(res.status).toBe(201);
    expect(res.body.task.labels).toEqual(['bug', 'UI', 'urgente']);

    const upd = await request(app).put(`${base()}/tasks/${res.body.task._id}`).set(authed(owner.token)).send({ labels: ['docs'] });
    expect(upd.body.task.labels).toEqual(['docs']);
    const clear = await request(app).put(`${base()}/tasks/${res.body.task._id}`).set(authed(owner.token)).send({ labels: [] });
    expect(clear.body.task.labels).toEqual([]);
  });

  test('massimo 5 etichette di massimo 20 caratteri', async () => {
    const many = await request(app).post(`${base()}/tasks`).set(authed(owner.token)).send({ title: 'x', labels: 'a,b,c,d,e,f' });
    expect(many.status).toBe(400);
    expect(many.body.errors.labels).toBeDefined();
    const long = await request(app).post(`${base()}/tasks`).set(authed(owner.token)).send({ title: 'x', labels: 'una-etichetta-troppo-lunga' });
    expect(long.status).toBe(400);
  });

  test('le etichette compaiono nei "miei task"', async () => {
    await request(app).post(`${base()}/tasks`).set(authed(owner.token)).send({ title: 'Mio', labels: 'frontend', assignee: owner.user._id });
    const mine = await request(app).get('/api/tasks/mine').set(authed(owner.token));
    expect(mine.body.tasks.find((t) => t.title === 'Mio').labels).toEqual(['frontend']);
  });
});

describe('Cronologia del progetto', () => {
  let p;
  const url = () => `/api/projects/${p._id}/activity`;

  beforeAll(async () => {
    p = await createProject(owner.token, { title: 'Con cronologia' });
    await addMember(owner, p, member);
    const t = await request(app).post(`/api/projects/${p._id}/tasks`).set(authed(owner.token)).send({ title: 'Primo', assignee: member.user._id });
    const id = t.body.task._id;
    await request(app).patch(`/api/projects/${p._id}/tasks/${id}/status`).set(authed(member.token)).send({ status: 'done' });
    await request(app).post(`/api/projects/${p._id}/tasks/${id}/comments`).set(authed(member.token)).send({ text: 'finito' });
    await request(app).patch(`/api/projects/${p._id}/tasks/${id}/assignee`).set(authed(owner.token)).send({ assignee: null });
    await request(app).delete(`/api/projects/${p._id}/tasks/${id}`).set(authed(owner.token));
    await request(app).patch(`/api/projects/${p._id}/archive`).set(authed(owner.token)).send({});
    await request(app).patch(`/api/projects/${p._id}/archive`).set(authed(owner.token)).send({ archived: false });
  });

  test('registra le azioni, dalla più recente, con autore e testo leggibile', async () => {
    const res = await request(app).get(url()).set(authed(member.token));
    expect(res.status).toBe(200);
    expect(res.body.activities.map((a) => a.type)).toEqual([
      'project_reactivated',
      'project_archived',
      'task_deleted',
      'task_assigned',
      'comment_added',
      'task_moved',
      'task_assigned',
      'task_created',
      'member_joined',
    ]);
    const moved = res.body.activities.find((a) => a.type === 'task_moved');
    expect(moved.text).toBe('Member ha spostato "Primo" in Completato');
    expect(moved.actor.name).toBe('Member');
    expect(res.body.activities.find((a) => a.type === 'task_deleted').text).toContain('Primo');
  });

  test('è riservata ai membri e si pagina con il cursore', async () => {
    expect((await request(app).get(url()).set(authed(stranger.token))).status).toBe(403);
    expect((await request(app).get(url())).status).toBe(401);
    const first = await request(app).get(`${url()}?limit=4`).set(authed(owner.token));
    expect(first.body.activities).toHaveLength(4);
    expect(first.body.hasMore).toBe(true);
    const rest = await request(app).get(`${url()}?limit=10&before=${first.body.activities[3]._id}`).set(authed(owner.token));
    expect(rest.body.activities).toHaveLength(5);
    expect(rest.body.hasMore).toBe(false);
    expect((await request(app).get(`${url()}?before=zzz`).set(authed(owner.token))).status).toBe(400);
  });

  test('registra anche rimozione e uscita dei membri; sparisce con il progetto', async () => {
    await request(app).delete(`/api/projects/${p._id}/members/${member.user._id}`).set(authed(owner.token));
    await addMember(owner, p, member);
    await request(app).post(`/api/projects/${p._id}/leave`).set(authed(member.token));
    const res = await request(app).get(`${url()}?limit=3`).set(authed(owner.token));
    expect(res.body.activities.map((a) => a.type)).toEqual(['member_left', 'member_joined', 'member_removed']);

    const Activity = require('../src/models/Activity');
    await request(app).delete(`/api/projects/${p._id}`).set(authed(owner.token));
    expect(await Activity.countDocuments({ project: p._id })).toBe(0);
  });
});
