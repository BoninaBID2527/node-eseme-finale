const User = require('../models/User');
const Task = require('../models/Task');
const AppError = require('../utils/AppError');
const { emitToProject, joinProjectRoom, leaveProjectRoom, notifyUser } = require('../sockets/emit');
const { requiredText } = require('../utils/validate');

// Il proprietario invita un utente registrato tramite email.
async function addMember(req, res) {
  const { project } = req;
  const email = requiredText(req.body.email, 'L\'email').toLowerCase();

  const user = await User.findOne({ email });
  if (!user) throw new AppError(404, 'Nessun utente registrato con questa email');
  if (user.blocked) throw new AppError(400, 'Questo utente è bloccato');
  if (project.owner.equals(user.id) || project.members.some((m) => m.equals(user.id))) {
    throw new AppError(409, 'L\'utente fa già parte del progetto');
  }

  project.members.push(user.id);
  await project.save();

  joinProjectRoom(user.id, project.id);
  emitToProject(project.id, 'member:joined', { projectId: project.id, user });

  // Avvisa il nuovo membro e il proprietario/gli altri membri.
  const text = (name) => `${name} è entrato nel progetto "${project.title}"`;
  await notifyUser(user.id, { type: 'member_joined', text: `Sei stato aggiunto al progetto "${project.title}"`, project: project.id });
  const others = [project.owner, ...project.members].filter((id) => !id.equals(user.id));
  await Promise.all(
    others.map((id) => notifyUser(id, { type: 'member_joined', text: text(user.name), project: project.id }))
  );

  await project.populate([
    { path: 'owner', select: 'name email' },
    { path: 'members', select: 'name email' },
  ]);
  res.status(201).json({ project });
}

async function removeMember(req, res) {
  const { project } = req;
  const { userId } = req.params;

  if (project.owner.equals(userId)) throw new AppError(400, 'Il proprietario non può essere rimosso');
  if (!project.members.some((m) => m.equals(userId))) throw new AppError(404, 'Questo utente non è un membro del progetto');

  project.members = project.members.filter((m) => !m.equals(userId));
  await project.save();
  // I task assegnati a chi esce tornano senza assegnatario.
  await Task.updateMany({ project: project.id, assignee: userId }, { assignee: null });

  emitToProject(project.id, 'member:removed', { projectId: project.id, userId });
  leaveProjectRoom(userId, project.id);
  res.json({ message: 'Membro rimosso' });
}

module.exports = { addMember, removeMember };
