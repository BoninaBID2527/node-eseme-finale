const Project = require('../models/Project');
const Report = require('../models/Report');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { Validator, escapeRegex } = require('../utils/validate');
const { getPage, pageInfo } = require('../utils/pagination');
const { projectPayload } = require('../utils/projectData');
const { emitToProject, joinProjectRoom, evictFromProject, disconnectUser, notifyUser } = require('../sockets/emit');

const search = (q) => new RegExp(escapeRegex(String(q).slice(0, 80)), 'i');

async function stats(req, res) {
  const [users, blockedUsers, projects, hiddenProjects, openReports] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ blocked: true }),
    Project.countDocuments(),
    Project.countDocuments({ status: 'hidden' }),
    Report.countDocuments({ status: 'open' }),
  ]);
  res.json({ users, blockedUsers, projects, hiddenProjects, openReports });
}

async function listReports(req, res) {
  const { status = 'open' } = req.query;
  const v = new Validator();
  v.oneOf('status', status, ['all', 'open', 'dismissed', 'actioned'], 'Stato');
  v.throwIfErrors();

  const filter = status === 'all' ? {} : { status };
  const paging = getPage(req.query, { defaultLimit: 15, maxLimit: 50 });
  const [total, reports] = await Promise.all([
    Report.countDocuments(filter),
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .populate({ path: 'project', select: 'title status owner', populate: { path: 'owner', select: 'name' } })
      .populate('reporter', 'name email')
      .populate('resolvedBy', 'name'),
  ]);
  res.json({ reports, ...pageInfo(total, paging) });
}

// PATCH body { status: 'open'|'dismissed'|'actioned', note }: l'admin esamina la segnalazione.
async function updateReport(req, res) {
  const v = new Validator();
  const status = v.oneOf('status', req.body.status, ['open', 'dismissed', 'actioned'], 'Stato');
  const note = v.text('note', req.body.note, { label: 'La nota', max: 500 });
  v.throwIfErrors();

  const report = await Report.findById(req.params.id);
  if (!report) throw new AppError(404, 'Segnalazione non trovata');

  report.status = status;
  report.adminNote = note;
  report.resolvedBy = status === 'open' ? undefined : req.user.id;
  report.resolvedAt = status === 'open' ? undefined : new Date();
  await report.save();
  await report.populate([
    { path: 'project', select: 'title status' },
    { path: 'reporter', select: 'name email' },
    { path: 'resolvedBy', select: 'name' },
  ]);
  res.json({ report });
}

async function listProjects(req, res) {
  const { status = 'all', q } = req.query;
  const v = new Validator();
  v.oneOf('status', status, ['all', 'active', 'archived', 'hidden'], 'Stato');
  v.throwIfErrors();

  const filter = {};
  if (status !== 'all') filter.status = status;
  if (q) filter.title = search(q);

  const paging = getPage(req.query, { defaultLimit: 15, maxLimit: 50 });
  const [total, projects] = await Promise.all([
    Project.countDocuments(filter),
    Project.find(filter).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit).populate('owner', 'name email'),
  ]);

  // Quante segnalazioni aperte ha ogni progetto della pagina.
  const counts = await Report.aggregate([
    { $match: { project: { $in: projects.map((p) => p._id) }, status: 'open' } },
    { $group: { _id: '$project', count: { $sum: 1 } } },
  ]);
  const openReports = new Map(counts.map((c) => [String(c._id), c.count]));

  res.json({
    projects: projects.map((p) => ({ ...p.toJSON(), openReports: openReports.get(String(p._id)) || 0 })),
    ...pageInfo(total, paging),
  });
}

// PATCH body { hidden: true|false } (default true).
// Oscurare un progetto: sparisce dal catalogo, i membri (tranne il proprietario) perdono accesso e connessione live,
// le segnalazioni aperte risultano gestite e il proprietario viene avvisato.
async function hideProject(req, res) {
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError(404, 'Progetto non trovato');

  const hide = req.body.hidden !== false;
  if (hide && project.status !== 'hidden') {
    project.status = 'hidden';
    await project.save();

    await Report.updateMany(
      { project: project.id, status: 'open' },
      { status: 'actioned', resolvedBy: req.user.id, resolvedAt: new Date() }
    );
    await notifyUser(project.owner, {
      type: 'project_hidden',
      text: `Il progetto "${project.title}" è stato oscurato da un amministratore`,
      project: project.id,
    });
    emitToProject(project.id, 'project:updated', projectPayload(project));
    await evictFromProject(project.id, [project.owner]);
  } else if (!hide && project.status === 'hidden') {
    project.status = 'active';
    await project.save();
    [project.owner, ...project.members].forEach((id) => joinProjectRoom(id, project.id));
    emitToProject(project.id, 'project:updated', projectPayload(project));
  }

  res.json({ project });
}

async function listUsers(req, res) {
  const { status = 'all', q } = req.query;
  const v = new Validator();
  v.oneOf('status', status, ['all', 'blocked', 'active'], 'Stato');
  v.throwIfErrors();

  const filter = {};
  if (status === 'blocked') filter.blocked = true;
  if (status === 'active') filter.blocked = false;
  if (q) filter.$or = [{ name: search(q) }, { email: search(q) }];

  const paging = getPage(req.query, { defaultLimit: 15, maxLimit: 50 });
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit),
  ]);
  res.json({ users, ...pageInfo(total, paging) });
}

// PATCH body { blocked: true|false } (default true). Il blocco vale subito: API (token rifiutati) e connessioni live.
async function blockUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, 'Utente non trovato');
  if (user.role === 'admin') throw new AppError(400, 'Non puoi bloccare un amministratore');

  user.blocked = req.body.blocked !== false;
  await user.save();
  if (user.blocked) await disconnectUser(user.id, { reason: 'blocked' });
  res.json({ user });
}

module.exports = { stats, listReports, updateReport, listProjects, hideProject, listUsers, blockUser };
