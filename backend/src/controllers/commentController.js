const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskComment = require('../models/TaskComment');
const AppError = require('../utils/AppError');
const { Validator, isId } = require('../utils/validate');
const { emitToProject, notifyUsers } = require('../sockets/emit');
const { logActivity } = require('../utils/activity');

const PAGE_SIZE = 30;

async function findTask(req) {
  const task = await Task.findOne({ _id: req.params.taskId, project: req.project.id });
  if (!task) throw new AppError(404, 'Task non trovato');
  return task;
}

// Commenti di un task, dal più vecchio al più recente, a pagine con cursore (come la chat).
async function listComments(req, res) {
  const task = await findTask(req);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || PAGE_SIZE, 1), 100);
  const filter = { task: task.id };
  if (req.query.before) {
    if (!isId(req.query.before)) throw new AppError(400, 'Cursore non valido');
    filter._id = { $lt: req.query.before };
  }

  const rows = await TaskComment.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('author', 'name');
  res.json({ comments: rows.slice(0, limit).reverse(), hasMore: rows.length > limit });
}

async function addComment(req, res) {
  const { project } = req;
  const task = await findTask(req);
  const v = new Validator();
  const text = v.text('text', req.body.text, { label: 'Il commento', required: true, max: 1000 });
  v.throwIfErrors();

  const comment = await TaskComment.create({ project: project.id, task: task.id, author: req.user.id, text });
  await comment.populate('author', 'name');

  emitToProject(project.id, 'comment:created', comment);

  // Avvisa chi segue il task (assegnatario e autore), tranne chi ha scritto.
  const followers = [task.assignee, task.createdBy].filter(Boolean).map(String);
  const recipients = [...new Set(followers)].filter((id) => id !== req.user.id);
  await notifyUsers(recipients, {
    type: 'task_comment',
    text: `${req.user.name} ha commentato il task "${task.title}" in "${project.title}"`,
    project: project.id,
    task: task.id,
  });
  await logActivity({ project, actor: req.user, type: 'comment_added', text: `${req.user.name} ha commentato "${task.title}"`, task: task.id });

  res.status(201).json({ comment });
}

// Può eliminare un commento chi l'ha scritto oppure il proprietario del progetto (moderazione).
async function deleteComment(req, res) {
  const { project } = req;
  const task = await findTask(req);
  const comment = mongoose.isValidObjectId(req.params.commentId)
    ? await TaskComment.findOne({ _id: req.params.commentId, task: task.id })
    : null;
  if (!comment) throw new AppError(404, 'Commento non trovato');
  if (!comment.author.equals(req.user.id) && !req.isOwner) {
    throw new AppError(403, 'Puoi eliminare solo i tuoi commenti');
  }

  await comment.deleteOne();
  emitToProject(project.id, 'comment:deleted', { _id: comment.id, task: task.id, project: project.id });
  res.json({ message: 'Commento eliminato' });
}

module.exports = { listComments, addComment, deleteComment };
