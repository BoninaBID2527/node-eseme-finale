const { app, request, connect, disconnect, createUser, createProject, authed } = require('./helpers');

let owner, member, stranger, admin, project;

beforeAll(async () => {
  await connect();
  owner = await createUser('Owner');
  member = await createUser('Member');
  stranger = await createUser('Stranger');
  admin = await createUser('Admin', { admin: true });
  project = await createProject(owner.token, { title: 'Privato', visibility: 'private' });
});
afterAll(disconnect);

describe('Progetti e permessi', () => {
  test('creazione senza titolo → 400', async () => {
    const res = await request(app).post('/api/projects').set(authed(owner.token)).send({});
    expect(res.status).toBe(400);
  });

  test('un progetto privato non è visibile agli estranei ma sì all\'admin', async () => {
    expect((await request(app).get(`/api/projects/${project._id}`).set(authed(stranger.token))).status).toBe(403);
    expect((await request(app).get(`/api/projects/${project._id}`).set(authed(admin.token))).status).toBe(200);
    expect((await request(app).get(`/api/projects/${project._id}`).set(authed(owner.token))).status).toBe(200);
  });

  test('id non valido o inesistente → 404', async () => {
    expect((await request(app).get('/api/projects/abc').set(authed(owner.token))).status).toBe(404);
    expect((await request(app).get('/api/projects/64b7f0f4f4f4f4f4f4f4f4f4').set(authed(owner.token))).status).toBe(404);
  });

  test('solo il proprietario invita membri; l\'invitato diventa membro', async () => {
    const denied = await request(app)
      .post(`/api/projects/${project._id}/members`)
      .set(authed(stranger.token))
      .send({ email: member.email });
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .post(`/api/projects/${project._id}/members`)
      .set(authed(owner.token))
      .send({ email: member.email });
    expect(ok.status).toBe(201);

    const again = await request(app)
      .post(`/api/projects/${project._id}/members`)
      .set(authed(owner.token))
      .send({ email: member.email });
    expect(again.status).toBe(409);

    const view = await request(app).get(`/api/projects/${project._id}`).set(authed(member.token));
    expect(view.status).toBe(200);
    expect(view.body.isMember).toBe(true);
    expect(view.body.isOwner).toBe(false);
  });

  test('il membro non può modificare né archiviare il progetto', async () => {
    const put = await request(app).put(`/api/projects/${project._id}`).set(authed(member.token)).send({ title: 'Hack' });
    expect(put.status).toBe(403);
    const arch = await request(app).patch(`/api/projects/${project._id}/archive`).set(authed(member.token));
    expect(arch.status).toBe(403);
  });

  test('il proprietario modifica e archivia; il progetto esce dal catalogo', async () => {
    const pub = await createProject(owner.token, { title: 'Da archiviare' });
    const put = await request(app).put(`/api/projects/${pub._id}`).set(authed(owner.token)).send({ title: 'Nuovo titolo' });
    expect(put.body.project.title).toBe('Nuovo titolo');

    await request(app).patch(`/api/projects/${pub._id}/archive`).set(authed(owner.token)).send({});
    const catalog = await request(app).get('/api/projects/public');
    expect(catalog.body.projects.find((p) => p._id === pub._id)).toBeUndefined();
  });

  test('il proprietario cancella il progetto', async () => {
    const tmp = await createProject(owner.token, { title: 'Temporaneo' });
    expect((await request(app).delete(`/api/projects/${tmp._id}`).set(authed(member.token))).status).toBe(403);
    expect((await request(app).delete(`/api/projects/${tmp._id}`).set(authed(owner.token))).status).toBe(200);
    expect((await request(app).get(`/api/projects/${tmp._id}`).set(authed(owner.token))).status).toBe(404);
  });
});

describe('Catalogo pubblico e filtri', () => {
  beforeAll(async () => {
    await createProject(owner.token, { title: 'Sito React', category: 'Web', technologies: 'React,CSS' });
    await createProject(owner.token, { title: 'App Mobile', category: 'Mobile', technologies: 'Flutter' });
    await createProject(owner.token, { title: 'Segreto', visibility: 'private', category: 'Web' });
  });

  test('mostra solo progetti pubblici', async () => {
    const res = await request(app).get('/api/projects/public');
    expect(res.status).toBe(200);
    expect(res.body.projects.every((p) => p.visibility === 'public')).toBe(true);
    expect(res.body.projects.find((p) => p.title === 'Segreto')).toBeUndefined();
  });

  test('filtra per categoria e tecnologia (senza distinzione maiuscole)', async () => {
    const byCat = await request(app).get('/api/projects/public?category=mobile');
    expect(byCat.body.projects.map((p) => p.title)).toEqual(['App Mobile']);

    const byTech = await request(app).get('/api/projects/public?technology=react');
    expect(byTech.body.projects.map((p) => p.title)).toContain('Sito React');
    expect(byTech.body.projects.map((p) => p.title)).not.toContain('App Mobile');
  });

  test('filtra per data di creazione', async () => {
    const future = await request(app).get('/api/projects/public?from=2999-01-01');
    expect(future.body.projects).toHaveLength(0);
    const today = new Date().toISOString().slice(0, 10);
    const sameDay = await request(app).get(`/api/projects/public?from=${today}&to=${today}`);
    expect(sameDay.body.projects.length).toBeGreaterThan(0);
    expect((await request(app).get('/api/projects/public?from=boh')).status).toBe(400);
  });
});
