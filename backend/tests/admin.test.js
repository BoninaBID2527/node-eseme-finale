const { app, request, connect, disconnect, createUser, createProject, addMember, authed } = require('./helpers');

let owner, member, reporter, admin, project;

beforeAll(async () => {
  await connect();
  owner = await createUser('Owner');
  member = await createUser('Member');
  reporter = await createUser('Reporter');
  admin = await createUser('Admin', { admin: true });
  project = await createProject(owner.token, { title: 'Contestato' });
  await addMember(owner, project, member);
});
afterAll(disconnect);

describe('Segnalazioni e pannello admin', () => {
  test('segnalazione: stato iniziale "open" e notifica agli admin', async () => {
    const res = await request(app).post(`/api/projects/${project._id}/report`).set(authed(reporter.token)).send({ reason: 'Contenuto inappropriato' });
    expect(res.status).toBe(201);
    expect(res.body.report.status).toBe('open');

    const notifs = await request(app).get('/api/notifications').set(authed(admin.token));
    expect(notifs.body.notifications.some((n) => n.type === 'project_reported' && n.project === project._id)).toBe(true);
  });

  test('segnalazione duplicata → 409, del proprio progetto o senza motivo → 400', async () => {
    const url = `/api/projects/${project._id}/report`;
    expect((await request(app).post(url).set(authed(reporter.token)).send({ reason: 'ancora una volta' })).status).toBe(409);
    expect((await request(app).post(url).set(authed(owner.token)).send({ reason: 'è mio il progetto' })).status).toBe(400);
    const empty = await request(app).post(url).set(authed(admin.token)).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.errors.reason).toBeDefined();
  });

  test('le rotte admin sono vietate agli utenti normali e senza login', async () => {
    for (const path of ['/reports', '/users', '/projects', '/stats']) {
      expect((await request(app).get(`/api/admin${path}`).set(authed(reporter.token))).status).toBe(403);
      expect((await request(app).get(`/api/admin${path}`)).status).toBe(401);
    }
    expect((await request(app).patch(`/api/admin/projects/${project._id}/hide`).set(authed(owner.token)).send({})).status).toBe(403);
    expect((await request(app).patch(`/api/admin/users/${member.user._id}/block`).set(authed(owner.token)).send({})).status).toBe(403);
  });

  test('l\'admin consulta statistiche, segnalazioni, progetti e utenti con filtri', async () => {
    const stats = await request(app).get('/api/admin/stats').set(authed(admin.token));
    expect(stats.body).toMatchObject({ users: 4, openReports: 1, hiddenProjects: 0 });

    const reports = await request(app).get('/api/admin/reports').set(authed(admin.token));
    expect(reports.body.reports).toHaveLength(1);
    expect(reports.body.reports[0].project.title).toBe('Contestato');
    expect(reports.body.reports[0].reporter.email).toBe(reporter.email);

    const projects = await request(app).get('/api/admin/projects?q=contest').set(authed(admin.token));
    expect(projects.body.projects[0].openReports).toBe(1);
    const users = await request(app).get('/api/admin/users?q=report').set(authed(admin.token));
    expect(users.body.users.map((u) => u.name)).toEqual(['Reporter']);
    expect((await request(app).get('/api/admin/reports?status=boh').set(authed(admin.token))).status).toBe(400);
  });

  test('l\'admin archivia una segnalazione senza azioni', async () => {
    const other = await createProject(owner.token, { title: 'Altro' });
    const rep = await request(app).post(`/api/projects/${other._id}/report`).set(authed(reporter.token)).send({ reason: 'Falso allarme' });
    const res = await request(app).patch(`/api/admin/reports/${rep.body.report._id}`).set(authed(admin.token)).send({ status: 'dismissed', note: 'Tutto regolare' });
    expect(res.body.report).toMatchObject({ status: 'dismissed', adminNote: 'Tutto regolare' });
    expect(res.body.report.resolvedBy.name).toBe('Admin');
    // dopo la chiusura si può segnalare di nuovo
    expect((await request(app).post(`/api/projects/${other._id}/report`).set(authed(reporter.token)).send({ reason: 'Nuovo problema' })).status).toBe(201);
  });

  test('oscurare un progetto: catalogo, accessi dei membri, segnalazioni e notifica al proprietario', async () => {
    const hide = await request(app).patch(`/api/admin/projects/${project._id}/hide`).set(authed(admin.token)).send({});
    expect(hide.body.project.status).toBe('hidden');

    const catalog = await request(app).get('/api/projects/public?limit=30');
    expect(catalog.body.projects.find((p) => p._id === project._id)).toBeUndefined();

    // Il membro non ha più accesso, il proprietario solo in lettura, l'admin sì
    expect((await request(app).get(`/api/projects/${project._id}`).set(authed(member.token))).status).toBe(403);
    expect((await request(app).get(`/api/projects/${project._id}/tasks`).set(authed(member.token))).status).toBe(403);
    expect((await request(app).get(`/api/projects/${project._id}`).set(authed(reporter.token))).status).toBe(403);
    expect((await request(app).get(`/api/projects/${project._id}`).set(authed(owner.token))).status).toBe(200);
    expect((await request(app).post(`/api/projects/${project._id}/tasks`).set(authed(owner.token)).send({ title: 'x' })).status).toBe(409);
    expect((await request(app).get(`/api/projects/${project._id}`).set(authed(admin.token))).status).toBe(200);
    // ...e non compare più tra i progetti del membro
    const mine = await request(app).get('/api/projects/mine').set(authed(member.token));
    expect(mine.body.projects.find((p) => p._id === project._id)).toBeUndefined();

    const ownerNotifs = await request(app).get('/api/notifications').set(authed(owner.token));
    expect(ownerNotifs.body.notifications.some((n) => n.type === 'project_hidden')).toBe(true);
    const actioned = await request(app).get('/api/admin/reports?status=actioned').set(authed(admin.token));
    expect(actioned.body.reports.find((r) => r.project._id === project._id)).toBeDefined();

    // Riattivando, i membri tornano ad avere accesso
    await request(app).patch(`/api/admin/projects/${project._id}/hide`).set(authed(admin.token)).send({ hidden: false });
    expect((await request(app).get(`/api/projects/${project._id}/tasks`).set(authed(member.token))).status).toBe(200);
  });

  test('l\'admin blocca un utente: login e token non funzionano più; può sbloccarlo', async () => {
    const block = await request(app).patch(`/api/admin/users/${reporter.user._id}/block`).set(authed(admin.token)).send({});
    expect(block.body.user.blocked).toBe(true);

    expect((await request(app).post('/api/auth/login').send({ email: reporter.email, password: 'password123' })).status).toBe(403);
    expect((await request(app).get('/api/auth/me').set(authed(reporter.token))).status).toBe(403);
    expect((await request(app).get('/api/dashboard').set(authed(reporter.token))).status).toBe(403);

    await request(app).patch(`/api/admin/users/${reporter.user._id}/block`).set(authed(admin.token)).send({ blocked: false });
    expect((await request(app).get('/api/auth/me').set(authed(reporter.token))).status).toBe(200);
  });

  test('non si può bloccare un admin', async () => {
    expect((await request(app).patch(`/api/admin/users/${admin.user._id}/block`).set(authed(admin.token)).send({})).status).toBe(400);
  });
});
