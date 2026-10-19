const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

const TEST_URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/taskflow_test';

async function connect() {
  await mongoose.connect(TEST_URI);
  await mongoose.connection.dropDatabase(); // solo il database di test
  await mongoose.syncIndexes();
}

async function disconnect() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

// Registra un utente via API e restituisce { token, user, email }.
async function createUser(name, { admin = false } = {}) {
  const email = `${name.toLowerCase()}@test.it`;
  const res = await request(app).post('/api/auth/register').send({ name, email, password: 'password123' });
  if (admin) await User.updateOne({ _id: res.body.user._id }, { role: 'admin' });
  return { token: res.body.token, user: res.body.user, email };
}

const authed = (token) => ({ Authorization: `Bearer ${token}` });

async function createProject(token, data = {}) {
  const res = await request(app)
    .post('/api/projects')
    .set(authed(token))
    .send({ title: 'Progetto', visibility: 'public', category: 'Web', technologies: 'Node,React', ...data });
  return res.body.project;
}

// Il proprietario invita e l'utente accetta: restituisce la risposta di accettazione.
async function addMember(owner, project, member) {
  const invite = await request(app)
    .post(`/api/projects/${project._id}/invitations`)
    .set(authed(owner.token))
    .send({ email: member.email });
  return request(app).post(`/api/invitations/${invite.body.invitation._id}/accept`).set(authed(member.token));
}

module.exports = { app, request, connect, disconnect, createUser, createProject, addMember, authed };
