// Dati dimostrativi per lo sviluppo. NON cancella nulla: ogni utente e progetto viene creato solo se manca
// (cercato per email o per titolo+proprietario), quindi lo script si può rilanciare senza duplicare.
//   npm run seed
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { mongoUri, nodeEnv } = require('../src/config/env');
const migrate = require('../src/config/migrate');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Task = require('../src/models/Task');
const Message = require('../src/models/Message');
const Notification = require('../src/models/Notification');
const Invitation = require('../src/models/Invitation');
const Report = require('../src/models/Report');
const { users: demoUsers, projects: demoProjects, invitations: demoInvitations, reports: demoReports } = require('./demoData');

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (n) => new Date(Date.now() + n * DAY);
const log = { created: [], existing: [] };

async function ensureUsers() {
  const byKey = {};
  for (const demo of demoUsers) {
    let user = await User.findOne({ email: demo.email });
    if (user) {
      log.existing.push(`utente ${demo.email}`);
    } else {
      user = await User.create({ name: demo.name, email: demo.email, role: demo.role || 'user', passwordHash: await bcrypt.hash(demo.password, 10) });
      log.created.push(`utente ${demo.email}`);
    }
    byKey[demo.key] = user;
  }
  return byKey;
}

async function ensureProject(demo, users) {
  const owner = users[demo.owner];
  const existing = await Project.findOne({ title: demo.title, owner: owner.id });
  if (existing) {
    log.existing.push(`progetto "${demo.title}"`);
    return existing;
  }

  const members = (demo.members || []).map((key) => users[key].id);
  const project = await Project.create({
    title: demo.title,
    description: demo.description,
    category: demo.category,
    technologies: demo.technologies,
    visibility: demo.visibility || 'public',
    status: demo.status || 'active',
    owner: owner.id,
    members,
    createdAt: daysFromNow(-demo.createdDaysAgo),
  });

  for (const t of demo.tasks || []) {
    const task = await Task.create({
      project: project.id,
      title: t.title,
      description: t.description || '',
      priority: t.priority || 'medium',
      status: t.status || 'todo',
      dueDate: t.due === undefined ? undefined : daysFromNow(t.due),
      assignee: t.assignee ? users[t.assignee].id : null,
      createdBy: owner.id,
    });
    // Una notifica "task assegnato" per chi non l'ha creato, come accadrebbe usando l'app.
    if (t.assignee && users[t.assignee].id !== owner.id && t.status !== 'done') {
      await Notification.create({
        user: users[t.assignee].id,
        type: 'task_assigned',
        text: `${owner.name} ti ha assegnato il task "${task.title}" in "${project.title}"`,
        project: project.id,
        task: task.id,
        read: t.assignee === 'admin',
      });
    }
  }

  let minutesAgo = (demo.messages || []).length * 12;
  for (const m of demo.messages || []) {
    await Message.create({ project: project.id, author: users[m.author].id, text: m.text, createdAt: new Date(Date.now() - minutesAgo * 60 * 1000) });
    minutesAgo -= 12;
  }

  log.created.push(`progetto "${demo.title}" (${(demo.tasks || []).length} task)`);
  return project;
}

async function ensureInvitation(demo, users, projects) {
  const project = projects[demo.project];
  const invitee = users[demo.invitee];
  if (await Invitation.exists({ project: project.id, invitee: invitee.id, status: 'pending' })) return;

  const inviter = users[demo.inviter];
  const invitation = await Invitation.create({ project: project.id, invitee: invitee.id, inviter: inviter.id });
  await Notification.create({
    user: invitee.id,
    type: 'project_invitation',
    text: `${inviter.name} ti ha invitato nel progetto "${project.title}"`,
    project: project.id,
    invitation: invitation.id,
  });
  log.created.push(`invito ${invitee.name} → "${project.title}"`);
}

async function ensureReport(demo, users, projects) {
  const project = projects[demo.project];
  const reporter = users[demo.reporter];
  if (await Report.exists({ project: project.id, reporter: reporter.id })) return;

  await Report.create({ project: project.id, reporter: reporter.id, reason: demo.reason });
  const admins = await User.find({ role: 'admin' });
  for (const admin of admins) {
    await Notification.create({
      user: admin.id,
      type: 'project_reported',
      text: `Il progetto "${project.title}" è stato segnalato da ${reporter.name}`,
      project: project.id,
    });
  }
  log.created.push(`segnalazione su "${project.title}"`);
}

async function seed() {
  if (nodeEnv === 'production') throw new Error('Il seed dimostrativo non va eseguito in produzione');

  await mongoose.connect(mongoUri);
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
  await migrate();

  const users = await ensureUsers();
  const projects = {};
  for (const demo of demoProjects) projects[demo.key] = await ensureProject(demo, users);
  for (const demo of demoInvitations) await ensureInvitation(demo, users, projects);
  for (const demo of demoReports) await ensureReport(demo, users, projects);

  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`Creati: ${log.created.length}${log.created.length ? '\n  - ' + log.created.join('\n  - ') : ''}`);
  console.log(`Già presenti (non toccati): ${log.existing.length}`);
  console.log('\nAccessi di prova:');
  demoUsers.forEach((u) => console.log(`  ${u.role === 'admin' ? 'admin ' : 'utente'}  ${u.email}  /  ${u.password}`));
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed fallito:', err.message);
  process.exit(1);
});
