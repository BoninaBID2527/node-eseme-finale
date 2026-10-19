const mongoose = require('mongoose');
const Task = require('../models/Task');
const AppError = require('../utils/AppError');
const { emitToProject, notifyUser } = require('../sockets/emit');
const { requiredText, oneOf, parseDate } = require('../utils/validate');

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['todo', 'in_progress', 'done'];
const STATUS_LABEL = { todo: 'Da fare', in_progress: 'In corso', done: 'Completato' };

function ensureActive(project) {
  if (project.status === 'archived') throw new AppError(400, 'Il progetto è archiviato: i task non si possono modificare');
}

// L'assegnatario deve essere il proprietario o un membro del progetto (null = nessuno).
function checkAssignee(project, assigneeId) {
  if (assigneeId === null || assigneeId === '' || assigneeId === undefined) return null;
  const isInProject =
    mongoose.isValidObjectId(assigneeId) &&
    (project.owner.equals(assigneeId) || project.members.some((m) => m.equals(assigneeId)));
  if (!isInProject) throw new AppError(400, 'L\'assegnatario deve essere un membro del progetto');
  return assigneeId;
}

async function findTask(req) {
  const { taskId } = req.params;
  const task = mongoose.isValidObjectId(taskId)
    ? await Task.findOne({ _id: taskId, project: req.project.id })
    : null;
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
    });
  }
}

async function notifyMoved(task, project, actor) {
  if (task.assignee && !task.assignee._id.equals(actor.id)) {
    await notifyUser(task.assignee._id, {
      type: 'task_moved',
      text: `Il task "${task.title}" è ora in "${STATUS_LABEL[task.status]}"`,
      project: project.id,
    });
  }
}

async function listTasks(req, res) {
  const tasks = await Task.find({ project: req.project.id }).sort({ createdAt: 1 }).populate('assignee', 'name email');
  res.json({ tasks });
}

async function createTask(req, res) {
  const { project } = req;
  ensureActive(project);

  const task = await Task.create({
    project: project.id,
    title: requiredText(req.body.title, 'Il titolo', 120),
    description: (req.body.description || '').trim(),
    dueDate: req.body.dueDate ? parseDate(req.body.dueDate, 'La scadenza') : undefined,
    priority: oneOf(req.body.priority || 'medium', PRIORITIES, 'Priorità'),
    status: oneOf(req.body.status || 'todo', STATUSES, 'Stato'),
    assignee: checkAssignee(project, req.body.assignee),
    createdBy: req.user.id,
  });
  await populateTask(task);

  emitToProject(project.id, 'task:created', task);
  await notifyAssigned(task, project, req.user);
  res.status(201).json({ task });
}

async function updateTask(req, res) {
  const { project } = req;
  ensureActive(project);
  const task = await findTask(req);
  const { title, description, dueDate, priority, status, assignee } = req.body;

  const previousStatus = task.status;
  const previousAssignee = task.assignee && task.assignee.toString();

  if (title !== undefined) task.title = requiredText(title, 'Il titolo', 120);
  if (description !== undefined) task.description = String(description).trim();
  if (dueDate !== undefined) task.dueDate = dueDate ? parseDate(dueDate, 'La scadenza') : undefined;
  if (priority !== undefined) task.priority = oneOf(priority, PRIORITIES, 'Priorità');
  if (status !== undefined) task.status = oneOf(status, STATUSES, 'Stato');
  if (assignee !== undefined) task.assignee = checkAssignee(project, assignee);

  await task.save();
  await populateTask(task);

  emitToProject(project.id, 'task:updated', task);
  if (task.status !== previousStatus) await notifyMoved(task, project, req.user);
  if (task.assignee && task.assignee._id.toString() !== previousAssignee) await notifyAssigned(task, project, req.user);
  res.json({ task });
}

// Spostamento tra le colonne della bacheca.
async function moveTask(req, res) {
  const { project } = req;
  ensureActive(project);
  const task = await findTask(req);

  const status = oneOf(req.body.status, STATUSES, 'Stato');
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

// Riassegnazione ad un altro membro (assignee: null = rimuove l'assegnatario).
async function assignTask(req, res) {
  const { project } = req;
  ensureActive(project);
  const task = await findTask(req);

  if (req.body.assignee === undefined) throw new AppError(400, 'Il campo assignee è obbligatorio');
  task.assignee = checkAssignee(project, req.body.assignee);
  await task.save();
  await populateTask(task);

  emitToProject(project.id, 'task:updated', task);
  await notifyAssigned(task, project, req.user);
  res.json({ task });
}

async function deleteTask(req, res) {
  const { project } = req;
  ensureActive(project);
  const task = await findTask(req);
  await task.deleteOne();

  emitToProject(project.id, 'task:deleted', { _id: task.id, project: project.id });
  res.json({ message: 'Task eliminato' });
}

module.exports = { listTasks, createTask, updateTask, moveTask, assignTask, deleteTask };
