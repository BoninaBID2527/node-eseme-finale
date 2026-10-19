const Report = require('../models/Report');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { notifyUsers } = require('../sockets/emit');
const { Validator } = require('../utils/validate');

// Segnala un progetto visibile: gli admin ricevono una notifica live.
async function reportProject(req, res) {
  const { project } = req;
  const v = new Validator();
  const reason = v.text('reason', req.body.reason, { label: 'Il motivo', required: true, min: 5, max: 500 });
  v.throwIfErrors();

  if (project.owner.equals(req.user.id)) throw new AppError(400, 'Non puoi segnalare un tuo progetto');
  if (await Report.exists({ project: project.id, reporter: req.user.id, status: 'open' })) {
    throw new AppError(409, 'Hai già segnalato questo progetto: è in attesa di esame');
  }

  const report = await Report.create({ project: project.id, reporter: req.user.id, reason });

  const admins = await User.find({ role: 'admin', blocked: false }).select('_id');
  await notifyUsers(
    admins.map((a) => a.id),
    { type: 'project_reported', text: `Il progetto "${project.title}" è stato segnalato da ${req.user.name}`, project: project.id }
  );

  res.status(201).json({ report });
}

module.exports = { reportProject };
