// Dati dimostrativi per lo sviluppo. NON cancella nulla: ogni elemento viene creato solo se manca
// (utenti per email, progetti per titolo+proprietario, task per titolo nel progetto...), quindi lo script
// si può rilanciare senza duplicare e completa anche i progetti demo creati da versioni precedenti.
//   npm run seed
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { mongoUri, nodeEnv } = require('../src/config/env');
const migrate = require('../src/config/migrate');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Task = require('../src/models/Task');
const TaskComment = require('../src/models/TaskComment');
const Activity = require('../src/models/Activity');
const Message = require('../src/models/Message');
const Notification = require('../src/models/Notification');
const Invitation = require('../src/models/Invitation');
const Report = require('../src/models/Report');
const { users: demoUsers, projects: demoProjects, invitations: demoInvitations, reports: demoReports } = require('./demoData');

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const daysFromNow = (n) => new Date(Date.now() + n * DAY);
const STATUS_LABEL = { todo: 'Da fare', in_progress: 'In corso', done: 'Completato' };
const log = { created: [], existing: 0 };

async function ensureUsers() {
  const byKey = {};
  for (const demo of demoUsers) {
    let user = await User.findOne({ email: demo.email });
    if (user) {
      log.existing += 1;
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
    log.existing += 1;
    return existing;
  }
  log.created.push(`progetto "${demo.title}"`);
  return Project.create({
    title: demo.title,
    description: demo.description,
    category: demo.category,
    technologies: demo.technologies,
    visibility: demo.visibility || 'public',
    status: demo.status || 'active',
    owner: owner.id,
    members: (demo.members || []).map((key) => users[key].id),
    createdAt: daysFromNow(-demo.createdDaysAgo),
  });
}

// Task, etichette e commenti. Un task già presente non viene ricreato: se non ha etichette o commenti
// (progetti seminati da versioni precedenti) vengono aggiunti.
async function ensureTasks(project, demo, users) {
  const owner = users[demo.owner];
  const tasks = [];

  for (const t of demo.tasks || []) {
    let task = await Task.findOne({ project: project.id, title: t.title });
    if (!task) {
      task = await Task.create({
        project: project.id,
        title: t.title,
        description: t.description || '',
        priority: t.priority || 'medium',
        status: t.status || 'todo',
        dueDate: t.due === undefined ? undefined : daysFromNow(t.due),
        assignee: t.assignee ? users[t.assignee].id : null,
        labels: t.labels || [],
        createdBy: owner.id,
      });
      log.created.push(`task "${t.title}"`);
      // Come usando l'app: chi riceve un task creato da altri trova una notifica da leggere.
      if (t.assignee && users[t.assignee].id !== owner.id && t.status !== 'done') {
        await Notification.create({
          user: users[t.assignee].id,
          type: 'task_assigned',
          text: `${owner.name} ti ha assegnato il task "${task.title}" in "${project.title}"`,
          project: project.id,
          task: task.id,
        });
      }
    } else if (!task.labels.length && t.labels && t.labels.length) {
      task.labels = t.labels;
      await task.save();
      log.created.push(`etichette di "${t.title}"`);
    }
    tasks.push({ doc: task, demo: t });

    if (t.comments && !(await TaskComment.exists({ task: task.id }))) {
      for (const c of t.comments) {
        await TaskComment.create({ project: project.id, task: task.id, author: users[c.author].id, text: c.text, createdAt: new Date(Date.now() - c.ago * MINUTE) });
      }
      log.created.push(`${t.comments.length} commenti su "${t.title}"`);

      // Una notifica (non letta) per chi segue il task, riferita all'ultimo commento.
      const last = t.comments[t.comments.length - 1];
      const followers = new Set([t.assignee, demo.owner].filter(Boolean));
      followers.delete(last.author);
      for (const key of followers) {
        await Notification.create({
          user: users[key].id,
          type: 'task_comment',
          text: `${users[last.author].name} ha commentato il task "${task.title}" in "${project.title}"`,
          project: project.id,
          task: task.id,
        });
      }
    }
  }
  return tasks;
}

async function ensureMessages(project, demo, users) {
  if (!demo.messages || (await Message.exists({ project: project.id }))) return;
  let minutesAgo = demo.messages.length * 12;
  for (const m of demo.messages) {
    await Message.create({ project: project.id, author: users[m.author].id, text: m.text, createdAt: new Date(Date.now() - minutesAgo * MINUTE) });
    minutesAgo -= 12;
  }
  log.created.push(`${demo.messages.length} messaggi in "${demo.title}"`);
}

// Cronologia del progetto ricostruita dai dati demo (ingressi, task creati, assegnati, spostati, commenti).
// Si inserisce in ordine cronologico, perché l'elenco usa l'_id come cursore. Solo se il progetto non ne ha già una.
async function ensureActivities(project, demo, users, tasks) {
  if (await Activity.exists({ project: project.id })) return;

  const owner = users[demo.owner];
  const start = new Date(project.createdAt).getTime();
  const span = Date.now() - start;
  const events = [];
  const add = (time, actor, type, text, task) => events.push({ time: Math.min(time, Date.now() - MINUTE), actor, type, text, task });

  (demo.members || []).forEach((key, i) => add(start + (i + 1) * 6 * 60 * MINUTE, users[key], 'member_joined', `${users[key].name} è entrato nel progetto`));

  tasks.forEach(({ doc, demo: t }, i) => {
    const created = start + span * 0.06 * (i + 1) + 12 * 60 * MINUTE;
    const assignee = t.assignee ? users[t.assignee] : null;
    add(created, owner, 'task_created', `${owner.name} ha creato il task "${doc.title}"`, doc.id);
    if (assignee) add(created + 5 * MINUTE, owner, 'task_assigned', `${owner.name} ha assegnato "${doc.title}" a ${assignee.name}`, doc.id);
    const mover = assignee || owner;
    if (t.status === 'in_progress' || t.status === 'done') add(created + 4 * 60 * MINUTE, mover, 'task_moved', `${mover.name} ha spostato "${doc.title}" in ${STATUS_LABEL.in_progress}`, doc.id);
    if (t.status === 'done') add(created + DAY + 3 * 60 * MINUTE, mover, 'task_moved', `${mover.name} ha spostato "${doc.title}" in ${STATUS_LABEL.done}`, doc.id);
    (t.comments || []).forEach((c) => add(Date.now() - c.ago * MINUTE, users[c.author], 'comment_added', `${users[c.author].name} ha commentato "${doc.title}"`, doc.id));
  });
  if (demo.status === 'archived') add(start + span * 0.9, owner, 'project_archived', `${owner.name} ha archiviato il progetto`);

  if (!events.length) return; // progetto senza membri né task: nessuna attività da raccontare
  events.sort((a, b) => a.time - b.time);
  for (const e of events) {
    await Activity.create({ project: project.id, actor: e.actor.id, type: e.type, text: e.text, task: e.task, createdAt: new Date(e.time) });
  }
  log.created.push(`${events.length} attività in "${demo.title}"`);
}

async function ensureInvitation(demo, users, projects) {
  const project = projects[demo.project];
  const invitee = users[demo.invitee];
  const status = demo.status || 'pending';
  if (await Invitation.exists({ project: project.id, invitee: invitee.id, status })) return;

  const inviter = users[demo.inviter];
  const invitation = await Invitation.create({
    project: project.id,
    invitee: invitee.id,
    inviter: inviter.id,
    status,
    respondedAt: status === 'pending' ? undefined : daysFromNow(-1),
  });
  if (status === 'pending') {
    await Notification.create({
      user: invitee.id,
      type: 'project_invitation',
      text: `${inviter.name} ti ha invitato nel progetto "${project.title}"`,
      project: project.id,
      invitation: invitation.id,
    });
  }
  log.created.push(`invito (${status}) ${invitee.name} → "${project.title}"`);
}

async function ensureReport(demo, users, projects) {
  const project = projects[demo.project];
  const reporter = users[demo.reporter];
  if (await Report.exists({ project: project.id, reporter: reporter.id })) return;

  const status = demo.status || 'open';
  await Report.create({
    project: project.id,
    reporter: reporter.id,
    reason: demo.reason,
    status,
    adminNote: demo.note || '',
    resolvedBy: demo.resolvedBy ? users[demo.resolvedBy].id : undefined,
    resolvedAt: status === 'open' ? undefined : daysFromNow(-2),
  });
  if (status === 'open') {
    for (const admin of await User.find({ role: 'admin' })) {
      await Notification.create({
        user: admin.id,
        type: 'project_reported',
        text: `Il progetto "${project.title}" è stato segnalato da ${reporter.name}`,
        project: project.id,
      });
    }
  }
  log.created.push(`segnalazione (${status}) su "${project.title}"`);
}

async function seed() {
  if (nodeEnv === 'production') throw new Error('Il seed dimostrativo non va eseguito in produzione');

  await mongoose.connect(mongoUri);
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
  await migrate();

  const users = await ensureUsers();
  const projects = {};
  for (const demo of demoProjects) {
    const project = await ensureProject(demo, users);
    projects[demo.key] = project;
    const tasks = await ensureTasks(project, demo, users);
    await ensureMessages(project, demo, users);
    await ensureActivities(project, demo, users, tasks);
  }
  for (const demo of demoInvitations) await ensureInvitation(demo, users, projects);
  for (const demo of demoReports) await ensureReport(demo, users, projects);

  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`Creati: ${log.created.length}${log.created.length ? '\n  - ' + log.created.join('\n  - ') : ''}`);
  console.log(`Già presenti (non toccati): ${log.existing}`);
  console.log('\nAccessi di prova:');
  demoUsers.forEach((u) => console.log(`  ${u.role === 'admin' ? 'admin ' : 'utente'}  ${u.email}  /  ${u.password}`));
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed fallito:', err.message);
  process.exit(1);
});
