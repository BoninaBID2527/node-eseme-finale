const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const AppError = require('../utils/AppError');
const { emitToProject, notifyUser } = require('../sockets/emit');
const { Validator, escapeRegex } = require('../utils/validate');
const { getPage, pageInfo } = require('../utils/pagination');

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['todo', 'in_progress', 'done'];
const STATUS_LABEL = { todo: 'Da fare', in_progress: 'In corso', done: 'Completato' };

// L'assegnatario deve essere il proprietario o un membro del progetto (null/'' = nessuno).
function readAssignee(v, project, value) {
  if (value === null || value === '' || value === undefined) return null;
  const valid =
    mongoose.isValidObjectId(value) && (project.owner.equals(value) || project.members.some((m) => m.equals(value)));
  if (!valid) {
    v.fail('assignee', 'L\'assegnatario deve essere un membro del progetto');
    return undefined;
  }
  return value;
}

async function findTask(req) {
  const task = await Task.findOne({ _id: req.params.taskId, project: req.project.id });
  if (!task) throw new AppError(404, 'Task non trovato');
  return task;
}

const populateTask = (task) => task.populate('assignee', 'name email');

async function notifyAssigned(task, project, actor) {
  if (task.assignee && !task.assignee._id.equals(actor.id)) {
    await notifyUser(task.assignee._id, {
      type: 'task_assigned',
      text: `${actor.name} ti ha assegnato il task "${task.title}" in "${project.title}"`,
      project: project.id,
      task: task.id,
    });
  }
}

async function notifyMoved(task, project, actor) {
  if (task.assignee && !task.assignee._id.equals(actor.id)) {
    await notifyUser(task.assignee._id, {
      type: 'task_moved',
      text: `Il task "${task.title}" è ora in "${STATUS_LABEL[task.status]}"`,
      project: project.id,
      task: task.id,
    });
  }
}

async function listTasks(req, res) {
  const tasks = await Task.find({ project: req.project.id }).sort({ createdAt: 1 }).limit(1000).populate('assignee', 'name email');
  res.json({ tasks });
}

async function createTask(req, res) {
  const { project, body } = req;
  const v = new Validator();
  const data = {
    title: v.text('title', body.title, { label: 'Il titolo', required: true, max: 120 }),
    description: v.text('description', body.description, { label: 'La descrizione', max: 2000 }),
    priority: v.oneOf('priority', body.priority || 'medium', PRIORITIES, 'Priorità'),
    status: v.oneOf('status', body.status || 'todo', STATUSES, 'Stato'),
    assignee: readAssignee(v, project, body.assignee),
  };
  if (body.dueDate) data.dueDate = v.date('dueDate', body.dueDate, 'La scadenza');
  v.throwIfErrors();

  const task = await Task.create({ ...data, project: project.id, createdBy: req.user.id });
  await populateTask(task);

  emitToProject(project.id, 'task:created', task);
  await notifyAssigned(task, project, req.user);
  res.status(201).json({ task });
}

async function updateTask(req, res) {
  const { project, body } = req;
  const task = await findTask(req);
  const v = new Validator();

  const previousStatus = task.status;
  const previousAssignee = task.assignee && task.assignee.toString();

  if (body.title !== undefined) task.title = v.text('title', body.title, { label: 'Il titolo', required: true, max: 120 });
  if (body.description !== undefined) task.description = v.text('description', body.description, { label: 'La descrizione', max: 2000 });
  if (body.priority !== undefined) task.priority = v.oneOf('priority', body.priority, PRIORITIES, 'Priorità');
  if (body.status !== undefined) task.status = v.oneOf('status', body.status, STATUSES, 'Stato');
  if (body.assignee !== undefined) task.assignee = readAssignee(v, project, body.assignee);
  if (body.dueDate !== undefined) task.dueDate = body.dueDate ? v.date('dueDate', body.dueDate, 'La scadenza') : undefined;
  v.throwIfErrors();

  await task.save();
  await populateTask(task);

  emitToProject(project.id, 'task:updated', task);
  if (task.status !== previousStatus) await notifyMoved(task, project, req.user);
  if (task.assignee && task.assignee._id.toString() !== previousAssignee) await notifyAssigned(task, project, req.user);
  res.json({ task });
}

// Spostamento tra le colonne della bacheca (drag and drop o menu "Sposta in").
async function moveTask(req, res) {
  const { project } = req;
  const task = await findTask(req);

  const v = new Validator();
  const status = v.oneOf('status', req.body.status, STATUSES, 'Stato');
  v.throwIfErrors();

  if (status !== task.status) {
    task.status = status;
    await task.save();
    await populateTask(task);
    emitToProject(project.id, 'task:moved', task);
    await notifyMoved(task, project, req.user);
  } else {
    await populateTask(task);
  }
  res.json({ task });
}

// Riassegnazione ad un altro membro (assignee: null = nessun assegnatario).
async function assignTask(req, res) {
  const { project } = req;
  const task = await findTask(req);

  if (req.body.assignee === undefined) throw new AppError(400, 'Il campo assignee è obbligatorio', { assignee: 'Il campo assignee è obbligatorio' });
  const v = new Validator();
  const previous = task.assignee && task.assignee.toString();
  task.assignee = readAssignee(v, project, req.body.assignee);
  v.throwIfErrors();

  await task.save();
  await populateTask(task);

  emitToProject(project.id, 'task:updated', task);
  if (task.assignee && task.assignee._id.toString() !== previous) await notifyAssigned(task, project, req.user);
  res.json({ task });
}

async function deleteTask(req, res) {
  const { project } = req;
  const task = await findTask(req);
  await task.deleteOne();

  emitToProject(project.id, 'task:deleted', { _id: task.id, project: project.id });
  res.json({ message: 'Task eliminato' });
}

// Progetti i cui task l'utente può vedere (quelli oscurati restano visibili solo al proprietario).
async function visibleProjectIds(userId) {
  const projects = await Project.find({
    $and: [{ $or: [{ owner: userId }, { members: userId }] }, { $nor: [{ status: 'hidden', owner: { $ne: userId } }] }],
  }).select('_id');
  return projects.map((p) => p._id);
}

const startOfToday = () => new Date(new Date().setHours(0, 0, 0, 0));

// I miei task su tutti i progetti, con filtri e ordinati per scadenza (quelli senza scadenza in fondo).
async function myTasks(req, res) {
  const { status = 'open', due = 'all', q } = req.query;
  const v = new Validator();
  v.oneOf('status', status, ['open', 'all', ...STATUSES], 'Stato');
  v.oneOf('due', due, ['all', 'overdue', 'week', 'none'], 'Scadenza');
  v.throwIfErrors();

  const match = { assignee: new mongoose.Types.ObjectId(req.user.id), project: { $in: await visibleProjectIds(req.user.id) } };
  if (status === 'open') match.status = { $ne: 'done' };
  else if (status !== 'all') match.status = status;
  if (q) match.title = new RegExp(escapeRegex(String(q).slice(0, 80)), 'i');

  const today = startOfToday();
  if (due === 'overdue') Object.assign(match, { dueDate: { $lt: today }, status: { $ne: 'done' } });
  if (due === 'week') match.dueDate = { $gte: today, $lt: new Date(today.getTime() + 8 * 86400000) };
  if (due === 'none') match.dueDate = null;

  const paging = getPage(req.query, { defaultLimit: 20, maxLimit: 50 });
  const [total, rows] = await Promise.all([
    Task.countDocuments(match),
    Task.aggregate([
      { $match: match },
      { $addFields: { noDue: { $cond: [{ $ifNull: ['$dueDate', false] }, 0, 1] } } },
      { $sort: { noDue: 1, dueDate: 1, createdAt: -1 } },
      { $skip: paging.skip },
      { $limit: paging.limit },
    ]),
  ]);
  const tasks = await Task.populate(rows, { path: 'project', select: 'title status' });

  res.json({ tasks, ...pageInfo(total, paging) });
}

module.exports = { listTasks, createTask, updateTask, moveTask, assignTask, deleteTask, myTasks, visibleProjectIds, startOfToday };
