const { app, request, connect, disconnect, createUser, createProject, authed } = require('./helpers');

let owner, guest, other, project;
const invite = (token, email) =>
  request(app).post(`/api/projects/${project._id}/invitations`).set(authed(token)).send({ email });

beforeAll(async () => {
  await connect();
  owner = await createUser('Owner');
  guest = await createUser('Guest');
  other = await createUser('Other');
  project = await createProject(owner.token, { title: 'Con inviti' });
});
afterAll(disconnect);

describe('Inviti ai progetti', () => {
  test('solo il proprietario invita; email sconosciuta → 404, non valida → 400', async () => {
    expect((await invite(other.token, guest.email)).status).toBe(403);
    const unknown = await invite(owner.token, 'nessuno@test.it');
    expect(unknown.status).toBe(404);
    expect(unknown.body.errors.email).toBeDefined();
    expect((await invite(owner.token, 'non-email')).status).toBe(400);
    expect((await invite(owner.token, owner.email)).status).toBe(409);
  });

  test('l\'invito non dà accesso finché non viene accettato; un secondo invito in attesa → 409', async () => {
    const res = await invite(owner.token, guest.email);
    expect(res.status).toBe(201);
    expect(res.body.invitation.status).toBe('pending');
    expect((await invite(owner.token, guest.email)).status).toBe(409);
    expect((await request(app).get(`/api/projects/${project._id}/tasks`).set(authed(guest.token))).status).toBe(403);

    const mine = await request(app).get('/api/invitations').set(authed(guest.token));
    expect(mine.body.invitations).toHaveLength(1);
    expect(mine.body.invitations[0].project.title).toBe('Con inviti');
    expect(mine.body.invitations[0].inviter.name).toBe('Owner');

    const notif = await request(app).get('/api/notifications').set(authed(guest.token));
    expect(notif.body.notifications[0].type).toBe('project_invitation');
    expect(notif.body.notifications[0].invitation).toBe(res.body.invitation._id);
  });

  test('solo il destinatario può rispondere; accettando entra nel progetto e gli altri vengono avvisati', async () => {
    const mine = await request(app).get('/api/invitations').set(authed(guest.token));
    const id = mine.body.invitations[0]._id;

    expect((await request(app).post(`/api/invitations/${id}/accept`).set(authed(other.token))).status).toBe(404);
    expect((await request(app).post(`/api/invitations/${id}/accept`).set(authed(guest.token))).status).toBe(200);
    expect((await request(app).get(`/api/projects/${project._id}/tasks`).set(authed(guest.token))).status).toBe(200);
    // non si può accettare due volte
    expect((await request(app).post(`/api/invitations/${id}/accept`).set(authed(guest.token))).status).toBe(404);

    const ownerNotifs = await request(app).get('/api/notifications').set(authed(owner.token));
    expect(ownerNotifs.body.notifications.some((n) => n.type === 'member_joined')).toBe(true);
    expect((await request(app).get('/api/invitations').set(authed(guest.token))).body.invitations).toHaveLength(0);
  });

  test('rifiuto: nessun accesso e il proprietario riceve la notifica', async () => {
    const res = await invite(owner.token, other.email);
    const decline = await request(app).post(`/api/invitations/${res.body.invitation._id}/decline`).set(authed(other.token));
    expect(decline.status).toBe(200);
    expect((await request(app).get(`/api/projects/${project._id}/tasks`).set(authed(other.token))).status).toBe(403);
    const ownerNotifs = await request(app).get('/api/notifications').set(authed(owner.token));
    expect(ownerNotifs.body.notifications.some((n) => n.type === 'invitation_declined')).toBe(true);
    // dopo un rifiuto si può invitare di nuovo
    expect((await invite(owner.token, other.email)).status).toBe(201);
  });

  test('il proprietario vede gli inviti in attesa e può annullarli', async () => {
    const list = await request(app).get(`/api/projects/${project._id}/invitations`).set(authed(owner.token));
    expect(list.body.invitations).toHaveLength(1);
    expect(list.body.invitations[0].invitee.email).toBe(other.email);
    expect((await request(app).get(`/api/projects/${project._id}/invitations`).set(authed(guest.token))).status).toBe(403);

    const id = list.body.invitations[0]._id;
    expect((await request(app).delete(`/api/projects/${project._id}/invitations/${id}`).set(authed(owner.token))).status).toBe(200);
    expect((await request(app).post(`/api/invitations/${id}/accept`).set(authed(other.token))).status).toBe(404);
  });

  test('un invito a un progetto archiviato non è più accettabile', async () => {
    const p = await createProject(owner.token, { title: 'Poi archiviato' });
    const res = await request(app).post(`/api/projects/${p._id}/invitations`).set(authed(owner.token)).send({ email: other.email });
    await request(app).patch(`/api/projects/${p._id}/archive`).set(authed(owner.token)).send({});
    const mine = await request(app).get('/api/invitations').set(authed(other.token));
    expect(mine.body.invitations.find((i) => i.project._id === p._id)).toBeUndefined();
    expect((await request(app).post(`/api/invitations/${res.body.invitation._id}/accept`).set(authed(other.token))).status).toBe(409);
  });

  test('rimozione di un membro: perde accesso e riceve una notifica', async () => {
    expect((await request(app).delete(`/api/projects/${project._id}/members/${guest.user._id}`).set(authed(guest.token))).status).toBe(403);
    expect((await request(app).delete(`/api/projects/${project._id}/members/${owner.user._id}`).set(authed(owner.token))).status).toBe(400);
    expect((await request(app).delete(`/api/projects/${project._id}/members/${guest.user._id}`).set(authed(owner.token))).status).toBe(200);
    expect((await request(app).get(`/api/projects/${project._id}/tasks`).set(authed(guest.token))).status).toBe(403);
    const notifs = await request(app).get('/api/notifications').set(authed(guest.token));
    expect(notifs.body.notifications.some((n) => n.type === 'member_removed')).toBe(true);
    expect((await request(app).delete(`/api/projects/${project._id}/members/${guest.user._id}`).set(authed(owner.token))).status).toBe(404);
  });
});
