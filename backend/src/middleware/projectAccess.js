const mongoose = require('mongoose');
const Project = require('../models/Project');
const AppError = require('../utils/AppError');

// Carica il progetto da :id e calcola i ruoli dell'utente su quel progetto.
async function loadProject(req, res, next) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, 'Progetto non trovato');

  const project = await Project.findById(id);
  if (!project) throw new AppError(404, 'Progetto non trovato');

  const userId = req.user.id;
  req.project = project;
  req.isAdmin = req.user.role === 'admin';
  req.isOwner = project.owner.equals(userId);
  req.isMember = req.isOwner || project.members.some((m) => m.equals(userId));
  next();
}

// Un progetto è visibile se pubblico e non nascosto, oppure a membri e admin.
function canView(req, res, next) {
  const visibleToAll = req.project.visibility === 'public' && req.project.status !== 'hidden';
  if (!visibleToAll && !req.isMember && !req.isAdmin) throw new AppError(403, 'Non hai accesso a questo progetto');
  next();
}

function requireMember(req, res, next) {
  if (!req.isMember) throw new AppError(403, 'Solo i membri del progetto possono farlo');
  next();
}

function requireOwner(req, res, next) {
  if (!req.isOwner) throw new AppError(403, 'Solo il proprietario del progetto può farlo');
  next();
}

module.exports = { loadProject, canView, requireMember, requireOwner };
