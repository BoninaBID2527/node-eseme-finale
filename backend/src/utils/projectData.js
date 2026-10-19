const Task = require('../models/Task');

// Dati essenziali di un progetto, inviati negli eventi live (senza liste di utenti).
const projectPayload = (p) => ({
  _id: p.id,
  title: p.title,
  description: p.description,
  category: p.category,
  technologies: p.technologies,
  visibility: p.visibility,
  coverImage: p.coverImage,
  status: p.status,
  updatedAt: p.updatedAt,
});

// Aggiunge a ogni progetto { total, done } dei suoi task, con una sola query per tutta la lista.
async function attachProgress(projects) {
  if (!projects.length) return [];
  const rows = await Task.aggregate([
    { $match: { project: { $in: projects.map((p) => p._id) } } },
    { $group: { _id: '$project', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } },
  ]);
  const byProject = new Map(rows.map((r) => [String(r._id), r]));
  return projects.map((p) => {
    const obj = typeof p.toJSON === 'function' ? p.toJSON() : p;
    const row = byProject.get(String(p._id));
    return { ...obj, progress: { total: row ? row.total : 0, done: row ? row.done : 0 } };
  });
}

module.exports = { projectPayload, attachProgress };
