const { app, request, connect, disconnect, createUser, createProject, authed } = require('./helpers');

let owner, reporter, admin, project;

beforeAll(async () => {
  await connect();
  owner = await createUser('Owner');
  reporter = await createUser('Reporter');
  admin = await createUser('Admin', { admin: true });
  project = await createProject(owner.token, { title: 'Contestato' });
});
afterAll(disconnect);

describe('Segnalazioni e pannello admin', () => {
  test('segnalazione: l\'admin riceve la notifica', async () => {
    const res = await request(app).post(`/api/projects/${project._id}/report`).set(authed(reporter.token)).send({ reason: 'Contenuto inappropriato' });
    expect(res.status).toBe(201);

    const notifs = await request(app).get('/api/notifications').set(authed(admin.token));
    expect(notifs.body.notifications.some((n) => n.type === 'project_reported')).toBe(true);
  });

  test('segnalazione duplicata → 409, del proprio progetto o senza motivo → 400', async () => {
    const url = `/api/projects/${project._id}/report`;
    expect((await request(app).post(url).set(authed(reporter.token)).send({ reason: 'ancora' })).status).toBe(409);
    expect((await request(app).post(url).set(authed(owner.token)).send({ reason: 'mio' })).status).toBe(400);
    expect((await request(app).post(url).set(authed(admin.token)).send({})).status).toBe(400);
  });

  test('le rotte admin sono vietate agli utenti normali', async () => {
    expect((await request(app).get('/api/admin/reports').set(authed(reporter.token))).status).toBe(403);
    expect((await request(app).get('/api/admin/users').set(authed(reporter.token))).status).toBe(403);
    expect((await request(app).get('/api/admin/reports')).status).toBe(401);
  });

  test('l\'admin vede le segnalazioni e nasconde il progetto', async () => {
    const reports = await request(app).get('/api/admin/reports').set(authed(admin.token));
    expect(reports.body.reports).toHaveLength(1);
    expect(reports.body.reports[0].project.title).toBe('Contestato');

    const hide = await request(app).patch(`/api/admin/projects/${project._id}/hide`).set(authed(admin.token)).send({});
    expect(hide.body.project.status).toBe('hidden');

    const catalog = await request(app).get('/api/projects/public');
    expect(catalog.body.projects.find((p) => p._id === project._id)).toBeUndefined();
    // Il progetto nascosto non è più visibile agli altri utenti.
    expect((await request(app).get(`/api/projects/${project._id}`).set(authed(reporter.token))).status).toBe(403);
  });

  test('l\'admin blocca un utente: login e token non funzionano più', async () => {
    const block = await request(app).patch(`/api/admin/users/${reporter.user._id}/block`).set(authed(admin.token)).send({});
    expect(block.body.user.blocked).toBe(true);

    const login = await request(app).post('/api/auth/login').send({ email: reporter.email, password: 'password123' });
    expect(login.status).toBe(403);
    expect((await request(app).get('/api/auth/me').set(authed(reporter.token))).status).toBe(403);
  });

  test('non si può bloccare un admin', async () => {
    const res = await request(app).patch(`/api/admin/users/${admin.user._id}/block`).set(authed(admin.token)).send({});
    expect(res.status).toBe(400);
  });
});
