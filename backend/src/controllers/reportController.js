const Report = require('../models/Report');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { notifyAdmins } = require('../sockets/emit');
const { requiredText } = require('../utils/validate');

// Segnala un progetto visibile: gli admin ricevono una notifica live.
async function reportProject(req, res) {
  const { project } = req;
  const reason = requiredText(req.body.reason, 'Il motivo', 500);

  if (project.owner.equals(req.user.id)) throw new AppError(400, 'Non puoi segnalare un tuo progetto');
  if (await Report.exists({ project: project.id, reporter: req.user.id })) {
    throw new AppError(409, 'Hai già segnalato questo progetto');
  }

  const report = await Report.create({ project: project.id, reporter: req.user.id, reason });

  const admins = await User.find({ role: 'admin' }).select('_id');
  await notifyAdmins(
    admins.map((a) => a.id),
    { type: 'project_reported', text: `Il progetto "${project.title}" è stato segnalato: ${reason}`, project: project.id }
  );

  res.status(201).json({ report });
}

module.exports = { reportProject };
