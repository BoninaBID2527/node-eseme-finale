const mongoose = require('mongoose');
const Project = require('../models/Project');
const Report = require('../models/Report');
const User = require('../models/User');
const AppError = require('../utils/AppError');

async function listReports(req, res) {
  const reports = await Report.find()
    .sort({ createdAt: -1 })
    .populate('project', 'title status owner')
    .populate('reporter', 'name email');
  res.json({ reports });
}

async function listUsers(req, res) {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ users });
}

// PATCH body { hidden: true|false } (default true). Un progetto nascosto sparisce dal catalogo.
async function hideProject(req, res) {
  const { id } = req.params;
  const project = mongoose.isValidObjectId(id) ? await Project.findById(id) : null;
  if (!project) throw new AppError(404, 'Progetto non trovato');

  project.status = req.body.hidden === false ? 'active' : 'hidden';
  await project.save();
  res.json({ project });
}

// PATCH body { blocked: true|false } (default true).
async function blockUser(req, res) {
  const { id } = req.params;
  const user = mongoose.isValidObjectId(id) ? await User.findById(id) : null;
  if (!user) throw new AppError(404, 'Utente non trovato');
  if (user.role === 'admin') throw new AppError(400, 'Non puoi bloccare un amministratore');

  user.blocked = req.body.blocked !== false;
  await user.save();
  res.json({ user });
}

module.exports = { listReports, listUsers, hideProject, blockUser };
