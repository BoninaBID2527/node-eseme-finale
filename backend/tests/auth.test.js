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

  test('registrazione: email duplicata → 409, dati non validi → 400 con errori per campo', async () => {
    const dup = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Mario', email: 'mario@test.it', password: 'password123' });
    expect(dup.status).toBe(409);
    expect(dup.body.errors.email).toBeDefined();

    const bad = await request(app).post('/api/auth/register').send({ name: '', email: 'non-una-email', password: '123' });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.errors).sort()).toEqual(['email', 'name', 'password']);
  });

  test('login con password errata → 401, con campi mancanti → 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'mario@test.it', password: 'sbagliata' });
    expect(res.status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
  });

  test('rotte protette senza token → 401, con token → 200', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(authed('token-finto'))).status).toBe(401);
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

  test('profilo: modifica del nome', async () => {
    const { token } = await createUser('Paolo');
    const res = await request(app).patch('/api/auth/me').set(authed(token)).send({ name: 'Paolo Neri' });
    expect(res.body.user.name).toBe('Paolo Neri');
    expect((await request(app).patch('/api/auth/me').set(authed(token)).send({ name: ' ' })).status).toBe(400);
  });

  test('cambio password: verifica quella attuale e invalida i vecchi token', async () => {
    const { token, email } = await createUser('Elena');
    const wrong = await request(app).patch('/api/auth/password').set(authed(token)).send({ currentPassword: 'no', newPassword: 'nuovapassword1' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.errors.currentPassword).toBeDefined();

    const short = await request(app).patch('/api/auth/password').set(authed(token)).send({ currentPassword: 'password123', newPassword: 'corta' });
    expect(short.body.errors.newPassword).toBeDefined();

    // Il token emesso prima del cambio può avere lo stesso secondo di iat: aspetta per distinguerlo.
    await new Promise((r) => setTimeout(r, 1100));
    const ok = await request(app).patch('/api/auth/password').set(authed(token)).send({ currentPassword: 'password123', newPassword: 'nuovapassword1' });
    expect(ok.status).toBe(200);

    expect((await request(app).get('/api/auth/me').set(authed(token))).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(authed(ok.body.token))).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email, password: 'nuovapassword1' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email, password: 'password123' })).status).toBe(401);
  });

  test('rotta inesistente → 404 JSON, JSON malformato → 400', async () => {
    const res = await request(app).get('/api/non-esiste');
    expect(res.status).toBe(404);
    expect(res.body.message).toBeDefined();
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{non json');
    expect(bad.status).toBe(400);
  });
});
