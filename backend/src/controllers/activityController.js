const Activity = require('../models/Activity');
const AppError = require('../utils/AppError');
const { isId } = require('../utils/validate');

// Cronologia del progetto (solo membri): le attività più recenti, a pagine con cursore.
async function listActivity(req, res) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
  const filter = { project: req.project.id };
  if (req.query.before) {
    if (!isId(req.query.before)) throw new AppError(400, 'Cursore non valido');
    filter._id = { $lt: req.query.before };
  }

  const rows = await Activity.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('actor', 'name');
  res.json({ activities: rows.slice(0, limit), hasMore: rows.length > limit });
}

module.exports = { listActivity };
