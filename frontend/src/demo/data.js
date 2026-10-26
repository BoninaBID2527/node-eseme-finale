// Database dimostrativo in memoria per la demo statica. Riproduce quello che `npm run seed` crea su MongoDB,
// partendo dagli stessi contenuti (backend/scripts/demoData.js), così la demo mostra gli stessi dati dell'app vera.
// Le date sono calcolate rispetto al momento in cui si apre la pagina: scadenze e "2 ore fa" restano sempre attuali.
import demo from '../../../backend/scripts/demoData.js';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const STATUS_LABEL = { todo: 'Da fare', in_progress: 'In corso', done: 'Completato' };

export function createDatabase() {
  const now = Date.now();
  const seedTime = now - 95 * MINUTE; // il momento (finto) in cui è stato eseguito il seed
  const daysFromNow = (n) => new Date(now + n * DAY);

  // ObjectId crescenti nell'ordine di inserimento, come in MongoDB: le liste a cursore (chat, commenti,
  // cronologia) ordinano per _id.
  let counter = 0;
  const base = 0x6720a400; // fisso: gli id restano uguali a ogni apertura, così i link (es. /projects/:id) funzionano anche dopo un ricaricamento
  const oid = () => base.toString(16).padStart(8, '0') + (0x5f3a00000000 + ++counter).toString(16).padStart(16, '0');
  const stamp = () => new Date(seedTime + counter * 50);

  const db = { users: [], projects: [], tasks: [], comments: [], activities: [], messages: [], notifications: [], invitations: [], reports: [] };
  const insert = (collection, doc) => {
    const _id = oid();
    const createdAt = doc.createdAt || stamp();
    const row = { _id, ...doc, createdAt, updatedAt: doc.updatedAt || stamp() };
    db[collection].push(row);
    return row;
  };
  const notify = (user, data) => insert('notifications', { user: user._id, read: false, project: null, task: null, invitation: null, ...data });

  const users = {};
  for (const u of demo.users) {
    users[u.key] = insert('users', { name: u.name, email: u.email, role: u.role || 'user', blocked: false, password: u.password });
  }

  const projects = {};
  for (const p of demo.projects) {
    const owner = users[p.owner];
    const project = insert('projects', {
      title: p.title,
      description: p.description,
      category: p.category,
      technologies: p.technologies,
      visibility: p.visibility || 'public',
      status: p.status || 'active',
      coverImage: '',
      owner: owner._id,
      members: (p.members || []).map((k) => users[k]._id),
      createdAt: daysFromNow(-p.createdDaysAgo),
    });
    projects[p.key] = project;

    // Task, notifiche di assegnazione, commenti e notifiche sui commenti (come ensureTasks)
    const tasks = [];
    for (const t of p.tasks || []) {
      const task = insert('tasks', {
        project: project._id,
        title: t.title,
        description: t.description || '',
        priority: t.priority || 'medium',
        status: t.status || 'todo',
        dueDate: t.due === undefined ? null : daysFromNow(t.due),
        assignee: t.assignee ? users[t.assignee]._id : null,
        labels: t.labels || [],
        createdBy: owner._id,
      });
      if (t.assignee && users[t.assignee]._id !== owner._id && t.status !== 'done') {
        notify(users[t.assignee], { type: 'task_assigned', text: `${owner.name} ti ha assegnato il task "${task.title}" in "${project.title}"`, project: project._id, task: task._id });
      }
      tasks.push({ doc: task, demo: t });
      if (t.comments) {
        for (const c of t.comments) {
          insert('comments', { project: project._id, task: task._id, author: users[c.author]._id, text: c.text, createdAt: new Date(now - c.ago * MINUTE) });
        }
        const last = t.comments[t.comments.length - 1];
        const followers = new Set([t.assignee, p.owner].filter(Boolean));
        followers.delete(last.author);
        for (const key of followers) {
          notify(users[key], { type: 'task_comment', text: `${users[last.author].name} ha commentato il task "${task.title}" in "${project.title}"`, project: project._id, task: task._id });
        }
      }
    }

    // Messaggi di chat, uno ogni 12 minuti (come ensureMessages)
    if (p.messages) {
      let minutesAgo = p.messages.length * 12;
      for (const m of p.messages) {
        insert('messages', { project: project._id, author: users[m.author]._id, text: m.text, createdAt: new Date(now - minutesAgo * MINUTE) });
        minutesAgo -= 12;
      }
    }

    // Cronologia ricostruita (come ensureActivities)
    const start = project.createdAt.getTime();
    const span = now - start;
    const events = [];
    const add = (time, actor, type, text, task) => events.push({ time: Math.min(time, now - MINUTE), actor, type, text, task });
    (p.members || []).forEach((key, i) => add(start + (i + 1) * 6 * 60 * MINUTE, users[key], 'member_joined', `${users[key].name} è entrato nel progetto`));
    tasks.forEach(({ doc, demo: t }, i) => {
      const created = start + span * 0.06 * (i + 1) + 12 * 60 * MINUTE;
      const assignee = t.assignee ? users[t.assignee] : null;
      add(created, owner, 'task_created', `${owner.name} ha creato il task "${doc.title}"`, doc._id);
      if (assignee) add(created + 5 * MINUTE, owner, 'task_assigned', `${owner.name} ha assegnato "${doc.title}" a ${assignee.name}`, doc._id);
      const mover = assignee || owner;
      if (t.status === 'in_progress' || t.status === 'done') add(created + 4 * 60 * MINUTE, mover, 'task_moved', `${mover.name} ha spostato "${doc.title}" in ${STATUS_LABEL.in_progress}`, doc._id);
      if (t.status === 'done') add(created + DAY + 3 * 60 * MINUTE, mover, 'task_moved', `${mover.name} ha spostato "${doc.title}" in ${STATUS_LABEL.done}`, doc._id);
      (t.comments || []).forEach((c) => add(now - c.ago * MINUTE, users[c.author], 'comment_added', `${users[c.author].name} ha commentato "${doc.title}"`, doc._id));
    });
    if (p.status === 'archived') add(start + span * 0.9, owner, 'project_archived', `${owner.name} ha archiviato il progetto`);
    events.sort((a, b) => a.time - b.time);
    for (const e of events) insert('activities', { project: project._id, actor: e.actor._id, type: e.type, text: e.text, task: e.task || null, createdAt: new Date(e.time) });
  }

  for (const inv of demo.invitations) {
    const project = projects[inv.project];
    const status = inv.status || 'pending';
    const invitation = insert('invitations', {
      project: project._id,
      invitee: users[inv.invitee]._id,
      inviter: users[inv.inviter]._id,
      status,
      respondedAt: status === 'pending' ? null : daysFromNow(-1),
    });
    if (status === 'pending') {
      notify(users[inv.invitee], { type: 'project_invitation', text: `${users[inv.inviter].name} ti ha invitato nel progetto "${project.title}"`, project: project._id, invitation: invitation._id });
    }
  }

  for (const r of demo.reports) {
    const project = projects[r.project];
    const status = r.status || 'open';
    insert('reports', {
      project: project._id,
      reporter: users[r.reporter]._id,
      reason: r.reason,
      status,
      adminNote: r.note || '',
      resolvedBy: r.resolvedBy ? users[r.resolvedBy]._id : null,
      resolvedAt: status === 'open' ? null : daysFromNow(-2),
    });
    if (status === 'open') {
      db.users.filter((u) => u.role === 'admin').forEach((admin) => {
        notify(admin, { type: 'project_reported', text: `Il progetto "${project.title}" è stato segnalato da ${users[r.reporter].name}`, project: project._id });
      });
    }
  }

  return db;
}
