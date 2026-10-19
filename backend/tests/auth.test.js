const { app, request, connect, disconnect, createUser, authed } = require('./helpers');

beforeAll(connect);
afterAll(disconnect);

describe('Autenticazione', () => {
  test('registrazione e login restituiscono un token', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Mario', email: 'mario@test.it', password: 'password123' });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeDefined();
    expect(reg.body.user.passwordHash).toBeUndefined();

    const login = await request(app).post('/api/auth/login').send({ email: 'mario@test.it', password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();
  });

  test('registrazione: email duplicata → 409, dati non validi → 400', async () => {
    const dup = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Mario', email: 'mario@test.it', password: 'password123' });
    expect(dup.status).toBe(409);

    const bad = await request(app).post('/api/auth/register').send({ name: 'X', email: 'non-una-email', password: '123' });
    expect(bad.status).toBe(400);
  });

  test('login con password errata → 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'mario@test.it', password: 'sbagliata' });
    expect(res.status).toBe(401);
  });

  test('rotte protette senza token → 401, con token → 200', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const { token } = await createUser('Luca');
    const me = await request(app).get('/api/auth/me').set(authed(token));
    expect(me.status).toBe(200);
    expect(me.body.user.name).toBe('Luca');
  });

  test('dopo il logout il token non vale più', async () => {
    const { token } = await createUser('Anna');
    expect((await request(app).post('/api/auth/logout').set(authed(token))).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(authed(token))).status).toBe(401);
  });

  test('rotta inesistente → 404 JSON', async () => {
    const res = await request(app).get('/api/non-esiste');
    expect(res.status).toBe(404);
    expect(res.body.message).toBeDefined();
  });
});
