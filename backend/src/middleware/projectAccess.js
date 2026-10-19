const Project = require('../models/Project');
const AppError = require('../utils/AppError');

// Carica il progetto da :id e calcola i ruoli dell'utente su quel progetto.
// "Proprietario" e "membro" sono relativi al singolo progetto; "admin" è globale.
async function loadProject(req, res, next) {
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError(404, 'Progetto non trovato');

  const userId = req.user.id;
  req.project = project;
  req.isAdmin = req.user.role === 'admin';
  req.isOwner = project.owner.equals(userId);
  req.isMember = req.isOwner || project.members.some((m) => m.equals(userId));
  next();
}

// Chi può vedere la panoramica del progetto:
// - hidden: solo il proprietario e gli admin
// - private: membri e admin
// - public: tutti gli utenti loggati (ma bacheca e chat restano riservate ai membri)
function canView(req, res, next) {
  const { status, visibility } = req.project;
  const allowed =
    status === 'hidden' ? req.isOwner || req.isAdmin : visibility === 'public' || req.isMember || req.isAdmin;
  if (!allowed) throw new AppError(403, 'Non hai accesso a questo progetto');
  next();
}

// Bacheca, chat e inviti: solo membri; se il progetto è oscurato resta accessibile soltanto al proprietario.
function requireMember(req, res, next) {
  const hiddenForMe = req.project.status === 'hidden' && !req.isOwner;
  if (!req.isMember || hiddenForMe) throw new AppError(403, 'Solo i membri del progetto possono farlo');
  next();
}

function requireOwner(req, res, next) {
  if (!req.isOwner) throw new AppError(403, 'Solo il proprietario del progetto può farlo');
  next();
}

// Blocca le modifiche se il progetto è archiviato o oscurato (409: lo stato del progetto lo impedisce).
function requireWritable(req, res, next) {
  const { status } = req.project;
  if (status === 'archived') throw new AppError(409, 'Il progetto è archiviato: riattivalo per modificarlo');
  if (status === 'hidden') throw new AppError(409, 'Il progetto è stato oscurato da un amministratore');
  next();
}

module.exports = { loadProject, canView, requireMember, requireOwner, requireWritable };
