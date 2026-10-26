// "Backend" della demo statica: risponde alle letture (GET) con i dati dimostrativi in memoria, seguendo le stesse
// regole dei controller veri (permessi, filtri, ordinamenti, paginazione). Le azioni che scriverebbero sul server
// aprono invece un popup che spiega cosa farebbe il backend, e non salvano nulla.
import { createDatabase } from './data';
import { DEMO_MESSAGE } from './constants';
import { explain } from './explain';

const db = createDatabase();
const DAY = 86400000;

// ---------- piccoli strumenti ----------
const fail = (status, message, extra = {}) => {
  throw Object.assign(new Error(message), { status, ...extra });
};
const json = (value) => JSON.parse(JSON.stringify(value));
const byId = (collection, id) => db[collection].find((d) => d._id === id);
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const contains = (text, q) => new RegExp(escapeRegex(String(q).slice(0, 80)), 'i').test(text || '');
const sameText = (a, b) => String(a).localeCompare(String(b), 'it', { sensitivity: 'base' }) === 0;
const startOfToday = () => new Date(new Date().setHours(0, 0, 0, 0));
const time = (d) => (d ? new Date(d).getTime() : null);

function publicUser(id, withEmail = false) {
  const u = byId('users', id);
  if (!u) return null;
  return withEmail ? { _id: u._id, name: u.name, email: u.email } : { _id: u._id, name: u.name };
}
function fullUser(u) {
  const { password, ...rest } = u; // eslint-disable-line no-unused-vars
  return rest;
}
function getPage(query, { defaultLimit = 20, maxLimit = 50 } = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}
const pageInfo = (total, { page, limit }) => ({ total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) });
const paginate = (rows, paging) => rows.slice(paging.skip, paging.skip + paging.limit);
const withOwner = (p, withEmail = false) => ({ ...p, owner: publicUser(p.owner, withEmail) });
function withProgress(p) {
  const tasks = db.tasks.filter((t) => t.project === p._id);
  return { ...p, progress: { total: tasks.length, done: tasks.filter((t) => t.status === 'done').length } };
}
const projectRef = (id, fields = ['title', 'status']) => {
  const p = byId('projects', id);
  if (!p) return null;
  return Object.fromEntries([['_id', p._id], ...fields.map((f) => [f, p[f]])]);
};
const isMemberOf = (p, userId) => p.owner === userId || p.members.includes(userId);
const visibleProjectIds = (userId) =>
  db.projects.filter((p) => isMemberOf(p, userId) && !(p.status === 'hidden' && p.owner !== userId)).map((p) => p._id);

// ---------- sessione ----------
const TOKEN_PREFIX = 'demo:';
function currentUser(token, required = true) {
  const email = token && token.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : null;
  const user = email ? db.users.find((u) => u.email === email) : null;
  if (!user && required) fail(401, 'Token mancante', { code: 'session_invalid' });
  return user;
}

// Carica il progetto e i ruoli dell'utente (middleware loadProject + canView / requireMember / requireOwner).
function loadProject(id, user, need) {
  if (!/^[a-f0-9]{24}$/i.test(id)) fail(400, 'Identificativo non valido');
  const project = byId('projects', id);
  if (!project) fail(404, 'Progetto non trovato');
  const isAdmin = user.role === 'admin';
  const isOwner = project.owner === user._id;
  const isMember = isOwner || project.members.includes(user._id);
  if (need === 'view') {
    const allowed = project.status === 'hidden' ? isOwner || isAdmin : project.visibility === 'public' || isMember || isAdmin;
    if (!allowed) fail(403, 'Non hai accesso a questo progetto');
  }
  if (need === 'member' && (!isMember || (project.status === 'hidden' && !isOwner))) fail(403, 'Solo i membri del progetto possono farlo');
  if (need === 'owner' && !isOwner) fail(403, 'Solo il proprietario del progetto può farlo');
  return { project, isOwner, isMember, isAdmin };
}

// Lista a cursore per _id (chat, commenti, cronologia).
function cursorList(rows, query, defaultLimit, maxLimit, { newestFirst }) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  let list = [...rows].sort((a, b) => (a._id < b._id ? 1 : -1));
  if (query.before) list = list.filter((r) => r._id < query.before);
  const page = list.slice(0, limit);
  return { items: newestFirst ? page : page.reverse(), hasMore: list.length > limit };
}

// ---------- letture ----------
const routes = [
  ['GET', /^\/health$/, () => ({ status: 'ok' })],
  ['GET', /^\/auth\/me$/, (ctx) => ({ user: fullUser(ctx.user()) })],

  [
    'GET',
    /^\/projects\/public$/,
    (ctx) => {
      const { category, technology, from, to, q, sort = 'recent' } = ctx.query;
      let rows = db.projects.filter((p) => p.visibility === 'public' && p.status === 'active');
      if (category) rows = rows.filter((p) => sameText(p.category, category));
      if (technology) rows = rows.filter((p) => p.technologies.some((t) => sameText(t, technology)));
      if (q) rows = rows.filter((p) => contains(p.title, q) || contains(p.description, q));
      if (from) rows = rows.filter((p) => time(p.createdAt) >= time(from));
      if (to) rows = rows.filter((p) => time(p.createdAt) <= new Date(to).setHours(23, 59, 59, 999));
      const sorts = {
        recent: (a, b) => time(b.createdAt) - time(a.createdAt),
        oldest: (a, b) => time(a.createdAt) - time(b.createdAt),
        title: (a, b) => a.title.localeCompare(b.title, 'it', { sensitivity: 'base' }),
      };
      if (!sorts[sort]) fail(400, 'Dati non validi', { errors: { sort: 'Ordinamento non valido' } });
      rows.sort(sorts[sort]);
      const paging = getPage(ctx.query, { defaultLimit: 9, maxLimit: 30 });
      return { projects: paginate(rows, paging).map((p) => withOwner(p)), ...pageInfo(rows.length, paging) };
    },
  ],
  [
    'GET',
    /^\/projects\/public\/filters$/,
    () => {
      const rows = db.projects.filter((p) => p.visibility === 'public' && p.status === 'active');
      const count = (list) => {
        const map = new Map();
        list.forEach((name) => {
          const key = name.toLowerCase();
          const entry = map.get(key) || { name, count: 0 };
          entry.count += 1;
          map.set(key, entry);
        });
        return [...map.entries()].sort((a, b) => b[1].count - a[1].count || (a[0] < b[0] ? -1 : 1)).map(([, v]) => v);
      };
      const categories = new Map();
      rows.forEach((p) => categories.set(p.category, (categories.get(p.category) || 0) + 1));
      return {
        categories: [...categories.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([name, c]) => ({ name, count: c })),
        technologies: count(rows.flatMap((p) => p.technologies)).slice(0, 40),
      };
    },
  ],
  [
    'GET',
    /^\/projects\/mine$/,
    (ctx) => {
      const me = ctx.user()._id;
      const { role = 'all', status = 'all', q } = ctx.query;
      let rows = db.projects.filter((p) => {
        const mine = role === 'owner' ? p.owner === me : role === 'member' ? p.members.includes(me) : isMemberOf(p, me);
        return mine && !(p.status === 'hidden' && p.owner !== me);
      });
      if (status !== 'all') rows = rows.filter((p) => p.status === status);
      if (q) rows = rows.filter((p) => contains(p.title, q));
      rows.sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
      const paging = getPage(ctx.query, { defaultLimit: 12, maxLimit: 50 });
      return { projects: paginate(rows, paging).map((p) => withProgress(withOwner(p))), ...pageInfo(rows.length, paging) };
    },
  ],
  [
    'GET',
    /^\/projects\/([^/]+)$/,
    (ctx, id) => {
      const user = ctx.user();
      const { project, isOwner, isMember, isAdmin } = loadProject(id, user, 'view');
      const withEmail = isMember || isAdmin;
      let stats;
      if (isMember) {
        const tasks = db.tasks.filter((t) => t.project === project._id);
        const today = startOfToday().getTime();
        const n = (s) => tasks.filter((t) => t.status === s).length;
        stats = {
          todo: n('todo'),
          in_progress: n('in_progress'),
          done: n('done'),
          overdue: tasks.filter((t) => t.status !== 'done' && t.dueDate && time(t.dueDate) < today).length,
          total: tasks.length,
        };
      }
      return {
        project: { ...project, owner: publicUser(project.owner, withEmail), members: project.members.map((m) => publicUser(m, withEmail)) },
        isOwner,
        isMember,
        stats,
      };
    },
  ],
  [
    'GET',
    /^\/projects\/([^/]+)\/invitations$/,
    (ctx, id) => {
      const { project } = loadProject(id, ctx.user(), 'owner');
      const rows = db.invitations
        .filter((i) => i.project === project._id && i.status === 'pending')
        .sort((a, b) => time(b.createdAt) - time(a.createdAt))
        .map((i) => ({ ...i, invitee: publicUser(i.invitee, true) }));
      return { invitations: rows };
    },
  ],
  [
    'GET',
    /^\/projects\/([^/]+)\/tasks$/,
    (ctx, id) => {
      const { project } = loadProject(id, ctx.user(), 'member');
      const rows = db.tasks
        .filter((t) => t.project === project._id)
        .sort((a, b) => time(a.createdAt) - time(b.createdAt))
        .map((t) => ({ ...t, assignee: t.assignee ? publicUser(t.assignee, true) : null, commentCount: db.comments.filter((c) => c.task === t._id).length }));
      return { tasks: rows };
    },
  ],
  [
    'GET',
    /^\/projects\/([^/]+)\/tasks\/([^/]+)\/comments$/,
    (ctx, id, taskId) => {
      const { project } = loadProject(id, ctx.user(), 'member');
      const task = db.tasks.find((t) => t._id === taskId && t.project === project._id);
      if (!task) fail(404, 'Task non trovato');
      const { items, hasMore } = cursorList(db.comments.filter((c) => c.task === task._id), ctx.query, 30, 100, { newestFirst: false });
      return { comments: items.map((c) => ({ ...c, author: publicUser(c.author) })), hasMore };
    },
  ],
  [
    'GET',
    /^\/projects\/([^/]+)\/activity$/,
    (ctx, id) => {
      const { project } = loadProject(id, ctx.user(), 'member');
      const { items, hasMore } = cursorList(db.activities.filter((a) => a.project === project._id), ctx.query, 15, 50, { newestFirst: true });
      return { activities: items.map((a) => ({ ...a, actor: publicUser(a.actor) })), hasMore };
    },
  ],
  [
    'GET',
    /^\/projects\/([^/]+)\/messages$/,
    (ctx, id) => {
      const { project } = loadProject(id, ctx.user(), 'member');
      const { items, hasMore } = cursorList(db.messages.filter((m) => m.project === project._id), ctx.query, 30, 100, { newestFirst: false });
      return { messages: items.map((m) => ({ ...m, author: publicUser(m.author) })), hasMore };
    },
  ],
  [
    'GET',
    /^\/invitations$/,
    (ctx) => {
      const me = ctx.user()._id;
      const rows = db.invitations
        .filter((i) => i.invitee === me && i.status === 'pending')
        .sort((a, b) => time(b.createdAt) - time(a.createdAt))
        .map((i) => ({ ...i, project: projectRef(i.project, ['title', 'description', 'category', 'status']), inviter: publicUser(i.inviter) }))
        .filter((i) => i.project && i.project.status === 'active');
      return { invitations: rows };
    },
  ],
  [
    'GET',
    /^\/tasks\/mine$/,
    (ctx) => {
      const me = ctx.user()._id;
      const { status = 'open', due = 'all', q } = ctx.query;
      const visible = visibleProjectIds(me);
      const today = startOfToday().getTime();
      let rows = db.tasks.filter((t) => t.assignee === me && visible.includes(t.project));
      if (status === 'open') rows = rows.filter((t) => t.status !== 'done');
      else if (status !== 'all') rows = rows.filter((t) => t.status === status);
      if (q) rows = rows.filter((t) => contains(t.title, q));
      if (due === 'overdue') rows = rows.filter((t) => t.dueDate && time(t.dueDate) < today && t.status !== 'done');
      if (due === 'week') rows = rows.filter((t) => t.dueDate && time(t.dueDate) >= today && time(t.dueDate) < today + 8 * DAY);
      if (due === 'none') rows = rows.filter((t) => !t.dueDate);
      rows.sort((a, b) => (a.dueDate ? 0 : 1) - (b.dueDate ? 0 : 1) || (time(a.dueDate) || 0) - (time(b.dueDate) || 0) || time(b.createdAt) - time(a.createdAt));
      const paging = getPage(ctx.query, { defaultLimit: 20, maxLimit: 50 });
      return { tasks: paginate(rows, paging).map((t) => ({ ...t, project: projectRef(t.project) })), ...pageInfo(rows.length, paging) };
    },
  ],
  [
    'GET',
    /^\/dashboard$/,
    (ctx) => {
      const me = ctx.user()._id;
      const today = startOfToday().getTime();
      const weekEnd = today + 8 * DAY;
      const ids = visibleProjectIds(me);
      const open = db.tasks.filter((t) => t.assignee === me && ids.includes(t.project) && t.status !== 'done');
      const withProject = (t) => ({ ...t, project: projectRef(t.project) });
      const overdue = open.filter((t) => t.dueDate && time(t.dueDate) < today).sort((a, b) => time(a.dueDate) - time(b.dueDate));
      const upcoming = open.filter((t) => t.dueDate && time(t.dueDate) >= today).sort((a, b) => time(a.dueDate) - time(b.dueDate));
      const recent = db.projects.filter((p) => ids.includes(p._id)).sort((a, b) => time(b.updatedAt) - time(a.updatedAt)).slice(0, 6);
      const invitations = db.invitations
        .filter((i) => i.invitee === me && i.status === 'pending')
        .sort((a, b) => time(b.createdAt) - time(a.createdAt))
        .map((i) => ({ ...i, project: projectRef(i.project), inviter: publicUser(i.inviter) }))
        .filter((i) => i.project && i.project.status === 'active');
      return {
        stats: {
          created: db.projects.filter((p) => p.owner === me).length,
          memberOf: db.projects.filter((p) => p.members.includes(me) && p.status !== 'hidden').length,
          openTasks: open.length,
          overdue: overdue.length,
          dueThisWeek: open.filter((t) => t.dueDate && time(t.dueDate) >= today && time(t.dueDate) < weekEnd).length,
          pendingInvitations: invitations.length,
        },
        overdue: overdue.slice(0, 5).map(withProject),
        upcoming: upcoming.slice(0, 6).map(withProject),
        recentProjects: recent.map((p) => withProgress(withOwner(p))),
        invitations,
      };
    },
  ],
  [
    'GET',
    /^\/notifications$/,
    (ctx) => {
      const me = ctx.user()._id;
      const mine = db.notifications.filter((n) => n.user === me);
      const rows = (ctx.query.unread === 'true' ? mine.filter((n) => !n.read) : mine).sort((a, b) => time(b.createdAt) - time(a.createdAt) || (a._id < b._id ? 1 : -1));
      const paging = getPage(ctx.query, { defaultLimit: 20, maxLimit: 50 });
      return { notifications: paginate(rows, paging), unread: mine.filter((n) => !n.read).length, ...pageInfo(rows.length, paging) };
    },
  ],
  ['GET', /^\/notifications\/unread-count$/, (ctx) => ({ unread: db.notifications.filter((n) => n.user === ctx.user()._id && !n.read).length })],

  // ---------- amministrazione ----------
  [
    'GET',
    /^\/admin\/stats$/,
    (ctx) => {
      ctx.admin();
      return {
        users: db.users.length,
        blockedUsers: db.users.filter((u) => u.blocked).length,
        projects: db.projects.length,
        hiddenProjects: db.projects.filter((p) => p.status === 'hidden').length,
        openReports: db.reports.filter((r) => r.status === 'open').length,
      };
    },
  ],
  [
    'GET',
    /^\/admin\/reports$/,
    (ctx) => {
      ctx.admin();
      const { status = 'open' } = ctx.query;
      const rows = db.reports.filter((r) => status === 'all' || r.status === status).sort((a, b) => time(b.createdAt) - time(a.createdAt));
      const paging = getPage(ctx.query, { defaultLimit: 15, maxLimit: 50 });
      return {
        reports: paginate(rows, paging).map((r) => {
          const p = byId('projects', r.project);
          return {
            ...r,
            project: p ? { _id: p._id, title: p.title, status: p.status, owner: publicUser(p.owner) } : null,
            reporter: publicUser(r.reporter, true),
            resolvedBy: r.resolvedBy ? publicUser(r.resolvedBy) : null,
          };
        }),
        ...pageInfo(rows.length, paging),
      };
    },
  ],
  [
    'GET',
    /^\/admin\/projects$/,
    (ctx) => {
      ctx.admin();
      const { status = 'all', q } = ctx.query;
      let rows = db.projects.filter((p) => status === 'all' || p.status === status);
      if (q) rows = rows.filter((p) => contains(p.title, q));
      rows.sort((a, b) => time(b.createdAt) - time(a.createdAt));
      const paging = getPage(ctx.query, { defaultLimit: 15, maxLimit: 50 });
      return {
        projects: paginate(rows, paging).map((p) => ({ ...withOwner(p, true), openReports: db.reports.filter((r) => r.project === p._id && r.status === 'open').length })),
        ...pageInfo(rows.length, paging),
      };
    },
  ],
  [
    'GET',
    /^\/admin\/users$/,
    (ctx) => {
      ctx.admin();
      const { status = 'all', q } = ctx.query;
      let rows = db.users.filter((u) => status === 'all' || (status === 'blocked' ? u.blocked : !u.blocked));
      if (q) rows = rows.filter((u) => contains(u.name, q) || contains(u.email, q));
      rows.sort((a, b) => time(b.createdAt) - time(a.createdAt) || (a._id < b._id ? 1 : -1));
      const paging = getPage(ctx.query, { defaultLimit: 15, maxLimit: 50 });
      return { users: paginate(rows, paging).map(fullUser), ...pageInfo(rows.length, paging) };
    },
  ],
];

// ---------- azioni che scriverebbero sul server ----------
// Si mostra il popup con la spiegazione; poi, per accesso e uscita, si simula l'esito per poter esplorare la demo.
async function write(method, path, body, token) {
  const info = explain(method, path);
  await showPopup(info, method, path);

  if (method === 'POST' && path === '/auth/login') {
    const email = String(body?.email || '').trim().toLowerCase();
    const errors = {};
    if (!email) errors.email = 'L\'email è obbligatoria';
    if (!body?.password) errors.password = 'La password è obbligatoria';
    if (Object.keys(errors).length) fail(400, 'Controlla i campi evidenziati', { errors });
    const user = db.users.find((u) => u.email === email);
    if (!user || user.password !== body.password) fail(401, 'Email o password non corretti');
    return { token: TOKEN_PREFIX + user.email, user: fullUser(user) };
  }
  if (method === 'POST' && path === '/auth/logout') {
    currentUser(token);
    return { message: 'Logout effettuato' };
  }
  if (method === 'POST' && path === '/auth/register') {
    fail(400, 'Nella demo non si creano account: accedi con uno degli account dimostrativi.', { demo: true });
  }
  fail(409, DEMO_MESSAGE, { demo: true });
}

// Il popup è disegnato da DemoLayer (React): qui si chiede di aprirlo e si aspetta che venga chiuso.
function showPopup(info, method, path) {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent('demo:popup', { detail: { info, method, path, resolve } }));
  });
}

export async function demoRequest(method, path, body, token) {
  const [pathname, search = ''] = path.split('?');
  const query = Object.fromEntries(new URLSearchParams(search));
  // un attimo di attesa, come una vera chiamata di rete: così si vedono anche gli skeleton di caricamento
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 160));

  try {
    if (method !== 'GET') return json(await write(method, pathname, body, token));
    const ctx = {
      query,
      user: () => currentUser(token),
      admin: () => {
        const u = currentUser(token);
        if (u.role !== 'admin') fail(403, 'Accesso riservato agli amministratori');
        return u;
      },
    };
    for (const [m, pattern, handler] of routes) {
      const match = m === method && pathname.match(pattern);
      if (match) return json(handler(ctx, ...match.slice(1)));
    }
    fail(404, 'Risorsa non trovata');
  } catch (err) {
    if (!err.status) throw err;
    const error = new Error(err.message);
    error.status = err.status;
    error.fields = err.errors;
    error.code = err.code;
    error.demo = err.demo;
    throw error;
  }
}
