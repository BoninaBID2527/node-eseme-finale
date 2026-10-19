const { app, request, connect, disconnect, createUser, createProject, addMember, authed } = require('./helpers');

// PNG 1x1 valido
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let owner, member, stranger, admin, project;

beforeAll(async () => {
  await connect();
  owner = await createUser('Owner');
  member = await createUser('Member');
  stranger = await createUser('Stranger');
  admin = await createUser('Admin', { admin: true });
  project = await createProject(owner.token, { title: 'Privato', visibility: 'private' });
  await addMember(owner, project, member);
});
afterAll(disconnect);

describe('Progetti e permessi', () => {
  test('creazione senza titolo → 400 con errore sul campo; visibilità non valida → 400', async () => {
    const res = await request(app).post('/api/projects').set(authed(owner.token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.errors.title).toBeDefined();
    const bad = await request(app).post('/api/projects').set(authed(owner.token)).send({ title: 'x', visibility: 'boh' });
    expect(bad.body.errors.visibility).toBeDefined();
  });

  test('un progetto privato non è visibile agli estranei ma sì ai membri e all\'admin', async () => {
    expect((await request(app).get(`/api/projects/${project._id}`).set(authed(stranger.token))).status).toBe(403);
    expect((await request(app).get(`/api/projects/${project._id}`).set(authed(admin.token))).status).toBe(200);
    expect((await request(app).get(`/api/projects/${project._id}`).set(authed(member.token))).status).toBe(200);
    expect((await request(app).get(`/api/projects/${project._id}`)).status).toBe(401);
  });

  test('id malformato → 400, id inesistente → 404', async () => {
    expect((await request(app).get('/api/projects/abc').set(authed(owner.token))).status).toBe(400);
    expect((await request(app).get('/api/projects/64b7f0f4f4f4f4f4f4f4f4f4').set(authed(owner.token))).status).toBe(404);
  });

  test('un progetto pubblico è visibile a tutti ma bacheca e chat restano riservate ai membri', async () => {
    const pub = await createProject(owner.token, { title: 'Aperto' });
    const view = await request(app).get(`/api/projects/${pub._id}`).set(authed(stranger.token));
    expect(view.status).toBe(200);
    expect(view.body.isMember).toBe(false);
    expect(view.body.stats).toBeUndefined();
    expect((await request(app).get(`/api/projects/${pub._id}/tasks`).set(authed(stranger.token))).status).toBe(403);
    expect((await request(app).get(`/api/projects/${pub._id}/messages`).set(authed(stranger.token))).status).toBe(403);
    expect((await request(app).post(`/api/projects/${pub._id}/tasks`).set(authed(stranger.token)).send({ title: 'x' })).status).toBe(403);
  });

  test('privacy: gli estranei non vedono le email dei membri, i membri sì', async () => {
    const pub = await createProject(owner.token, { title: 'Con membri' });
    await addMember(owner, pub, member);
    const asStranger = await request(app).get(`/api/projects/${pub._id}`).set(authed(stranger.token));
    expect(asStranger.body.project.members[0].name).toBe('Member');
    expect(asStranger.body.project.members[0].email).toBeUndefined();
    expect(asStranger.body.project.owner.email).toBeUndefined();
    const asMember = await request(app).get(`/api/projects/${pub._id}`).set(authed(member.token));
    expect(asMember.body.project.members[0].email).toBe(member.email);
  });

  test('il membro non può modificare, archiviare o eliminare il progetto', async () => {
    expect((await request(app).put(`/api/projects/${project._id}`).set(authed(member.token)).send({ title: 'Hack' })).status).toBe(403);
    expect((await request(app).patch(`/api/projects/${project._id}/archive`).set(authed(member.token))).status).toBe(403);
    expect((await request(app).delete(`/api/projects/${project._id}`).set(authed(member.token))).status).toBe(403);
  });

  test('il proprietario modifica; archiviato = sola lettura finché non viene riattivato', async () => {
    const p = await createProject(owner.token, { title: 'Da archiviare' });
    await addMember(owner, p, member);
    const put = await request(app).put(`/api/projects/${p._id}`).set(authed(owner.token)).send({ title: 'Nuovo titolo' });
    expect(put.body.project.title).toBe('Nuovo titolo');

    await request(app).patch(`/api/projects/${p._id}/archive`).set(authed(owner.token)).send({});
    const catalog = await request(app).get('/api/projects/public');
    expect(catalog.body.projects.find((x) => x._id === p._id)).toBeUndefined();

    // Tutte le scritture sono rifiutate con 409
    const url = `/api/projects/${p._id}`;
    expect((await request(app).put(url).set(authed(owner.token)).send({ title: 'x' })).status).toBe(409);
    expect((await request(app).post(`${url}/tasks`).set(authed(owner.token)).send({ title: 'x' })).status).toBe(409);
    expect((await request(app).post(`${url}/messages`).set(authed(member.token)).send({ text: 'ciao' })).status).toBe(409);
    expect((await request(app).post(`${url}/invitations`).set(authed(owner.token)).send({ email: stranger.email })).status).toBe(409);
    expect((await request(app).delete(`${url}/members/${member.user._id}`).set(authed(owner.token))).status).toBe(409);
    // ...ma la lettura resta possibile
    expect((await request(app).get(`${url}/tasks`).set(authed(member.token))).status).toBe(200);
    expect((await request(app).get(`${url}/messages`).set(authed(member.token))).status).toBe(200);

    await request(app).patch(`${url}/archive`).set(authed(owner.token)).send({ archived: false });
    expect((await request(app).post(`${url}/tasks`).set(authed(owner.token)).send({ title: 'ok' })).status).toBe(201);
  });

  test('cancellazione: elimina anche task e messaggi collegati', async () => {
    const tmp = await createProject(owner.token, { title: 'Temporaneo' });
    await request(app).post(`/api/projects/${tmp._id}/tasks`).set(authed(owner.token)).send({ title: 'T' });
    expect((await request(app).delete(`/api/projects/${tmp._id}`).set(authed(owner.token))).status).toBe(200);
    expect((await request(app).get(`/api/projects/${tmp._id}`).set(authed(owner.token))).status).toBe(404);
    const Task = require('../src/models/Task');
    expect(await Task.countDocuments({ project: tmp._id })).toBe(0);
  });

  test('il membro può lasciare il progetto, il proprietario no', async () => {
    const p = await createProject(owner.token, { title: 'Da lasciare' });
    await addMember(owner, p, member);
    expect((await request(app).post(`/api/projects/${p._id}/leave`).set(authed(owner.token))).status).toBe(400);
    expect((await request(app).post(`/api/projects/${p._id}/leave`).set(authed(member.token))).status).toBe(200);
    expect((await request(app).get(`/api/projects/${p._id}/tasks`).set(authed(member.token))).status).toBe(403);
  });
});

describe('Copertine', () => {
  test('immagine valida accettata, sostituita e rimossa; file non immagine o SVG rifiutati', async () => {
    const ok = await request(app)
      .post('/api/projects')
      .set(authed(owner.token))
      .field('title', 'Con copertina')
      .attach('cover', PNG, { filename: 'c.png', contentType: 'image/png' });
    expect(ok.status).toBe(201);
    expect(ok.body.project.coverImage).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);
    expect((await request(app).get(ok.body.project.coverImage)).status).toBe(200);

    const svg = await request(app)
      .post('/api/projects')
      .set(authed(owner.token))
      .field('title', 'Svg')
      .attach('cover', Buffer.from('<svg/>'), { filename: 'x.svg', contentType: 'image/svg+xml' });
    expect(svg.status).toBe(400);
    expect(svg.body.errors.cover).toBeDefined();

    // Un file qualsiasi che si finge PNG viene rifiutato (si controllano i primi byte) e non resta sul disco.
    const fake = await request(app)
      .post('/api/projects')
      .set(authed(owner.token))
      .field('title', 'Falso')
      .attach('cover', Buffer.from('questo non è un png'), { filename: 'f.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);
    expect(fake.body.errors.cover).toBeDefined();

    const removed = await request(app).put(`/api/projects/${ok.body.project._id}`).set(authed(owner.token)).field('removeCover', 'true');
    expect(removed.body.project.coverImage).toBe('');
    expect((await request(app).get(ok.body.project.coverImage)).status).toBe(404);
    await request(app).delete(`/api/projects/${ok.body.project._id}`).set(authed(owner.token));
  });
});

describe('Catalogo pubblico', () => {
  beforeAll(async () => {
    await createProject(owner.token, { title: 'Sito React', description: 'Vetrina online', category: 'Web', technologies: 'React,CSS' });
    await createProject(owner.token, { title: 'App Mobile', category: 'Mobile', technologies: 'Flutter' });
    await createProject(owner.token, { title: 'Zeta', category: 'Dati', technologies: 'Python' });
    await createProject(owner.token, { title: 'Segreto', visibility: 'private', category: 'Web' });
  });

  test('mostra solo progetti pubblici e attivi, con totale e paginazione', async () => {
    const res = await request(app).get('/api/projects/public?limit=2&page=1');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(2);
    expect(res.body.total).toBeGreaterThanOrEqual(4);
    expect(res.body.pages).toBe(Math.ceil(res.body.total / 2));
    expect(res.body.projects.find((p) => p.title === 'Segreto')).toBeUndefined();

    const last = await request(app).get(`/api/projects/public?limit=2&page=${res.body.pages}`);
    expect(last.body.projects.length).toBeGreaterThan(0);
  });

  test('filtra per categoria, tecnologia e testo', async () => {
    expect((await request(app).get('/api/projects/public?category=mobile')).body.projects.map((p) => p.title)).toEqual(['App Mobile']);
    const byTech = await request(app).get('/api/projects/public?technology=react');
    expect(byTech.body.projects.map((p) => p.title)).toContain('Sito React');
    expect(byTech.body.projects.map((p) => p.title)).not.toContain('App Mobile');
    expect((await request(app).get('/api/projects/public?q=vetrina')).body.projects.map((p) => p.title)).toEqual(['Sito React']);
  });

  test('ordina per titolo e per data', async () => {
    const byTitle = await request(app).get('/api/projects/public?sort=title&limit=30');
    const titles = byTitle.body.projects.map((p) => p.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' })));
    const oldest = await request(app).get('/api/projects/public?sort=oldest&limit=30');
    const dates = oldest.body.projects.map((p) => new Date(p.createdAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
    expect((await request(app).get('/api/projects/public?sort=boh')).status).toBe(400);
  });

  test('filtra per intervallo di creazione', async () => {
    expect((await request(app).get('/api/projects/public?from=2999-01-01')).body.projects).toHaveLength(0);
    const today = new Date().toISOString().slice(0, 10);
    expect((await request(app).get(`/api/projects/public?from=${today}&to=${today}`)).body.projects.length).toBeGreaterThan(0);
    expect((await request(app).get('/api/projects/public?from=boh')).status).toBe(400);
  });

  test('categorie e tecnologie disponibili vengono dai dati reali', async () => {
    const res = await request(app).get('/api/projects/public/filters');
    expect(res.body.categories.map((c) => c.name)).toEqual(expect.arrayContaining(['Web', 'Mobile', 'Dati']));
    expect(res.body.technologies.map((t) => t.name)).toEqual(expect.arrayContaining(['React', 'Flutter', 'Python']));
  });

  test('"I miei progetti": filtra per ruolo e stato', async () => {
    const created = await request(app).get('/api/projects/mine?role=owner').set(authed(owner.token));
    expect(created.body.projects.every((p) => p.owner._id === owner.user._id)).toBe(true);
    const asMember = await request(app).get('/api/projects/mine?role=member').set(authed(member.token));
    expect(asMember.body.projects.length).toBeGreaterThan(0);
    expect(asMember.body.projects[0].progress).toBeDefined();
    expect((await request(app).get('/api/projects/mine?role=boh').set(authed(owner.token))).status).toBe(400);
  });
});
