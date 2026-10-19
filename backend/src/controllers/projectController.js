const fs = require('fs');
const path = require('path');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Message = require('../models/Message');
const Report = require('../models/Report');
const AppError = require('../utils/AppError');
const { uploadDir } = require('../middleware/upload');
const { requiredText, parseList, oneOf, parseDate, escapeRegex } = require('../utils/validate');

const VISIBILITY = ['public', 'private'];

function removeCover(coverImage) {
  if (!coverImage) return;
  fs.unlink(path.join(uploadDir, path.basename(coverImage)), () => {});
}

async function createProject(req, res) {
  const data = {
    title: requiredText(req.body.title, 'Il titolo', 100),
    description: (req.body.description || '').trim(),
    category: (req.body.category || 'Altro').trim(),
    technologies: parseList(req.body.technologies),
    visibility: oneOf(req.body.visibility || 'private', VISIBILITY, 'Visibilità'),
    owner: req.user.id,
  };
  if (req.file) data.coverImage = `/uploads/${req.file.filename}`;

  const project = await Project.create(data);
  res.status(201).json({ project });
}

// Catalogo pubblico: solo progetti pubblici e attivi, con filtri opzionali.
async function listPublic(req, res) {
  const { category, technology, from, to, q } = req.query;
  const filter = { visibility: 'public', status: 'active' };

  if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
  if (technology) filter.technologies = new RegExp(`^${escapeRegex(technology)}$`, 'i');
  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: regex }, { description: regex }];
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = parseDate(from, 'from');
    if (to) {
      // "to" include l'intera giornata indicata.
      const end = parseDate(to, 'to');
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const projects = await Project.find(filter).sort({ createdAt: -1 }).populate('owner', 'name');
  res.json({ projects });
}

async function getProject(req, res) {
  const project = await req.project.populate([
    { path: 'owner', select: 'name email' },
    { path: 'members', select: 'name email' },
  ]);
  res.json({ project, isOwner: req.isOwner, isMember: req.isMember });
}

async function updateProject(req, res) {
  const { project } = req;
  const { title, description, category, technologies, visibility } = req.body;

  if (title !== undefined) project.title = requiredText(title, 'Il titolo', 100);
  if (description !== undefined) project.description = String(description).trim();
  if (category !== undefined) project.category = String(category).trim() || 'Altro';
  if (technologies !== undefined) project.technologies = parseList(technologies);
  if (visibility !== undefined) project.visibility = oneOf(visibility, VISIBILITY, 'Visibilità');
  if (req.file) {
    removeCover(project.coverImage);
    project.coverImage = `/uploads/${req.file.filename}`;
  }

  await project.save();
  res.json({ project });
}

// PATCH body { archived: true|false } (default true).
async function archiveProject(req, res) {
  const { project } = req;
  if (project.status === 'hidden') throw new AppError(403, 'Il progetto è stato nascosto da un amministratore');

  project.status = req.body.archived === false ? 'active' : 'archived';
  await project.save();
  res.json({ project });
}

async function deleteProject(req, res) {
  const { project } = req;
  await Promise.all([
    Task.deleteMany({ project: project.id }),
    Message.deleteMany({ project: project.id }),
    Report.deleteMany({ project: project.id }),
  ]);
  removeCover(project.coverImage);
  await project.deleteOne();
  res.json({ message: 'Progetto eliminato' });
}

module.exports = { createProject, listPublic, getProject, updateProject, archiveProject, deleteProject };
