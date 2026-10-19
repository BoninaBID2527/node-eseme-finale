const Project = require('../models/Project');
const Task = require('../models/Task');
const Message = require('../models/Message');
const Report = require('../models/Report');
const Invitation = require('../models/Invitation');
const TaskComment = require('../models/TaskComment');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const { deleteUpload } = require('../middleware/upload');
const { Validator, parseList, escapeRegex } = require('../utils/validate');
const { getPage, pageInfo } = require('../utils/pagination');
const { projectPayload, attachProgress } = require('../utils/projectData');
const { emitToProject, evictFromProject } = require('../sockets/emit');
const { logActivity } = require('../utils/activity');

const VISIBILITY = ['public', 'private'];
const SORTS = { recent: { createdAt: -1 }, oldest: { createdAt: 1 }, title: { title: 1 } };

// Se la richiesta fallisce dopo l'upload, il file appena salvato non deve restare orfano.
const discardUpload = (req) => req.file && deleteUpload(`/uploads/${req.file.filename}`);

function readFields(body, v, { partial }) {
  const data = {};
  const has = (key) => !partial || body[key] !== undefined;

  if (has('title')) data.title = v.text('title', body.title, { label: 'Il titolo', required: true, max: 100 });
  if (has('description')) data.description = v.text('description', body.description, { label: 'La descrizione', max: 2000 });
  if (has('category')) data.category = v.text('category', body.category, { label: 'La categoria', max: 40 }) || 'Altro';
  if (has('technologies')) data.technologies = parseList(body.technologies);
  if (has('visibility')) data.visibility = v.oneOf('visibility', body.visibility || 'private', VISIBILITY, 'Visibilità');
  return data;
}

async function createProject(req, res) {
  try {
    const v = new Validator();
    const data = readFields(req.body, v, { partial: false });
    v.throwIfErrors();

    const project = await Project.create({ ...data, owner: req.user.id, coverImage: req.file ? `/uploads/${req.file.filename}` : '' });
    res.status(201).json({ project });
  } catch (err) {
    discardUpload(req);
    throw err;
  }
}

// Catalogo pubblico: solo progetti pubblici e attivi. Filtri, ordinamento e paginazione sono eseguiti dal database.
async function listPublic(req, res) {
  const { category, technology, from, to, q, sort = 'recent' } = req.query;
  const filter = { visibility: 'public', status: 'active' };
  const v = new Validator();

  if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
  if (technology) filter.technologies = new RegExp(`^${escapeRegex(technology)}$`, 'i');
  if (q) {
    const regex = new RegExp(escapeRegex(String(q).slice(0, 80)), 'i');
    filter.$or = [{ title: regex }, { description: regex }];
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = v.date('from', from, 'La data iniziale');
    if (to) {
      // "to" include l'intera giornata indicata.
      const end = v.date('to', to, 'La data finale');
      if (end) end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  v.oneOf('sort', sort, Object.keys(SORTS), 'Ordinamento');
  v.throwIfErrors();

  const paging = getPage(req.query, { defaultLimit: 9, maxLimit: 30 });
  const [total, projects] = await Promise.all([
    Project.countDocuments(filter),
    Project.find(filter)
      .sort(SORTS[sort])
      .collation({ locale: 'it', strength: 2 })
      .skip(paging.skip)
      .limit(paging.limit)
      .populate('owner', 'name'),
  ]);

  res.json({ projects, ...pageInfo(total, paging) });
}

// Categorie e tecnologie realmente presenti nel catalogo, per popolare i filtri.
async function publicFilters(req, res) {
  const match = { $match: { visibility: 'public', status: 'active' } };
  const [result] = await Project.aggregate([
    match,
    {
      $facet: {
        categories: [{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }],
        technologies: [
          { $unwind: '$technologies' },
          { $group: { _id: { $toLower: '$technologies' }, name: { $first: '$technologies' }, count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 40 },
        ],
      },
    },
  ]);
  res.json({
    categories: result.categories.map((c) => ({ name: c._id, count: c.count })),
    technologies: result.technologies.map((t) => ({ name: t.name, count: t.count })),
  });
}

// I miei progetti: creati da me e/o di cui sono membro. I progetti oscurati compaiono solo al proprietario.
async function listMine(req, res) {
  const { role = 'all', status = 'all', q } = req.query;
  const me = req.user.id;
  const v = new Validator();
  v.oneOf('role', role, ['all', 'owner', 'member'], 'Ruolo');
  v.oneOf('status', status, ['all', 'active', 'archived', 'hidden'], 'Stato');
  v.throwIfErrors();

  const roleFilter = { owner: [{ owner: me }], member: [{ members: me }], all: [{ owner: me }, { members: me }] }[role];
  const filter = { $and: [{ $or: roleFilter }, { $nor: [{ status: 'hidden', owner: { $ne: me } }] }] };
  if (status !== 'all') filter.$and.push({ status });
  if (q) filter.$and.push({ title: new RegExp(escapeRegex(String(q).slice(0, 80)), 'i') });

  const paging = getPage(req.query, { defaultLimit: 12, maxLimit: 50 });
  const [total, projects] = await Promise.all([
    Project.countDocuments(filter),
    Project.find(filter).sort({ updatedAt: -1 }).skip(paging.skip).limit(paging.limit).populate('owner', 'name'),
  ]);

  res.json({ projects: await attachProgress(projects), ...pageInfo(total, paging) });
}

// Dettaglio: i membri vedono nomi ed email dei compagni, gli estranei (progetto pubblico) solo i nomi.
async function getProject(req, res) {
  const { project, isMember } = req;
  const fields = isMember || req.isAdmin ? 'name email' : 'name';
  await project.populate([
    { path: 'owner', select: fields },
    { path: 'members', select: fields },
  ]);

  let stats;
  if (isMember) {
    const today = new Date().setHours(0, 0, 0, 0);
    const rows = await Task.aggregate([
      { $match: { project: project._id } },
      {
        $group: {
          _id: null,
          todo: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
          in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
          // $ifNull: in un'aggregazione "assente" risulta minore di qualsiasi data, quindi va escluso a parte.
          overdue: {
            $sum: { $cond: [{ $and: [{ $ne: ['$status', 'done'] }, { $ifNull: ['$dueDate', false] }, { $lt: ['$dueDate', new Date(today)] }] }, 1, 0] },
          },
        },
      },
    ]);
    const { todo = 0, in_progress = 0, done = 0, overdue = 0 } = rows[0] || {};
    stats = { todo, in_progress, done, overdue, total: todo + in_progress + done };
  }

  res.json({ project, isOwner: req.isOwner, isMember, stats });
}

async function updateProject(req, res) {
  const { project } = req;
  try {
    const v = new Validator();
    const data = readFields(req.body, v, { partial: true });
    v.throwIfErrors();

    const previousCover = project.coverImage;
    Object.assign(project, data);
    if (req.file) project.coverImage = `/uploads/${req.file.filename}`;
    else if (req.body.removeCover === 'true') project.coverImage = '';

    await project.save();
    if (project.coverImage !== previousCover) deleteUpload(previousCover);

    emitToProject(project.id, 'project:updated', projectPayload(project));
    res.json({ project });
  } catch (err) {
    discardUpload(req);
    throw err;
  }
}

// PATCH body { archived: true|false } (default true). Un progetto archiviato è in sola lettura.
async function archiveProject(req, res) {
  const { project } = req;
  if (project.status === 'hidden') throw new AppError(409, 'Il progetto è stato oscurato da un amministratore');

  project.status = req.body.archived === false ? 'active' : 'archived';
  await project.save();

  emitToProject(project.id, 'project:updated', projectPayload(project));
  const archived = project.status === 'archived';
  await logActivity({
    project,
    actor: req.user,
    type: archived ? 'project_archived' : 'project_reactivated',
    text: archived ? `${req.user.name} ha archiviato il progetto` : `${req.user.name} ha riattivato il progetto`,
  });
  res.json({ project });
}

// Cancellazione definitiva: rimuove anche task, messaggi, inviti, segnalazioni e notifiche collegate,
// avvisa chi è connesso e chiude l'accesso live al progetto.
async function deleteProject(req, res) {
  const { project } = req;
  const id = project.id;

  await Promise.all([
    Task.deleteMany({ project: id }),
    Message.deleteMany({ project: id }),
    Report.deleteMany({ project: id }),
    Invitation.deleteMany({ project: id }),
    Notification.deleteMany({ project: id }),
    TaskComment.deleteMany({ project: id }),
    Activity.deleteMany({ project: id }),
  ]);
  deleteUpload(project.coverImage);
  await project.deleteOne();

  emitToProject(id, 'project:deleted', { projectId: id, title: project.title });
  await evictFromProject(id, []);
  res.json({ message: 'Progetto eliminato' });
}

module.exports = { createProject, listPublic, publicFilters, listMine, getProject, updateProject, archiveProject, deleteProject };
