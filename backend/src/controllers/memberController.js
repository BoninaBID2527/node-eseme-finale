const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Invitation = require('../models/Invitation');
const AppError = require('../utils/AppError');
const { Validator } = require('../utils/validate');
const { emitToProject, emitToUser, joinProjectRoom, leaveProjectRoom, notifyUser, notifyUsers } = require('../sockets/emit');

const isInProject = (project, userId) => project.owner.equals(userId) || project.members.some((m) => m.equals(userId));

async function populatedProject(project) {
  return project.populate([
    { path: 'owner', select: 'name email' },
    { path: 'members', select: 'name email' },
  ]);
}

// ---------- Inviti (lato proprietario) ----------

// Il proprietario invita un utente registrato tramite email: entrerà nel progetto solo se accetta.
async function createInvitation(req, res) {
  const { project } = req;
  const v = new Validator();
  const email = v.email('email', req.body.email);
  v.throwIfErrors();

  const fail = (status, message) => {
    throw new AppError(status, message, { email: message });
  };

  const user = await User.findOne({ email });
  if (!user) fail(404, 'Nessun utente registrato con questa email');
  if (user.blocked) fail(400, 'Questo utente non può essere invitato');
  if (isInProject(project, user.id)) fail(409, 'L\'utente fa già parte del progetto');
  if (await Invitation.exists({ project: project.id, invitee: user.id, status: 'pending' })) {
    fail(409, 'Esiste già un invito in attesa per questo utente');
  }

  const invitation = await Invitation.create({ project: project.id, invitee: user.id, inviter: req.user.id });
  await invitation.populate('invitee', 'name email');

  await notifyUser(user.id, {
    type: 'project_invitation',
    text: `${req.user.name} ti ha invitato nel progetto "${project.title}"`,
    project: project.id,
    invitation: invitation.id,
  });
  emitToUser(user.id, 'invitation:created', { _id: invitation.id, project: { _id: project.id, title: project.title }, inviter: { name: req.user.name } });

  res.status(201).json({ invitation });
}

async function listProjectInvitations(req, res) {
  const invitations = await Invitation.find({ project: req.project.id, status: 'pending' })
    .sort({ createdAt: -1 })
    .populate('invitee', 'name email');
  res.json({ invitations });
}

async function cancelInvitation(req, res) {
  const invitation = await Invitation.findOne({ _id: req.params.invId, project: req.project.id, status: 'pending' });
  if (!invitation) throw new AppError(404, 'Invito non trovato o già gestito');

  invitation.status = 'cancelled';
  invitation.respondedAt = new Date();
  await invitation.save();
  emitToUser(invitation.invitee, 'invitation:updated', { _id: invitation.id, status: 'cancelled' });
  res.json({ message: 'Invito annullato' });
}

// ---------- Inviti (lato destinatario) ----------

async function myInvitations(req, res) {
  const invitations = await Invitation.find({ invitee: req.user.id, status: 'pending' })
    .sort({ createdAt: -1 })
    .populate('project', 'title description category status')
    .populate('inviter', 'name');
  // Un invito a un progetto archiviato, oscurato o cancellato non è più accettabile.
  res.json({ invitations: invitations.filter((i) => i.project && i.project.status === 'active') });
}

async function findMyPendingInvitation(req) {
  const invitation = await Invitation.findOne({ _id: req.params.id, invitee: req.user.id, status: 'pending' });
  if (!invitation) throw new AppError(404, 'Invito non trovato o già gestito');
  return invitation;
}

async function acceptInvitation(req, res) {
  const invitation = await findMyPendingInvitation(req);
  const project = await Project.findById(invitation.project);

  if (!project || project.status !== 'active') {
    invitation.status = 'cancelled';
    invitation.respondedAt = new Date();
    await invitation.save();
    throw new AppError(409, 'Il progetto non è più disponibile');
  }

  // $addToSet evita duplicati anche se l'utente clicca due volte.
  await Project.updateOne({ _id: project.id }, { $addToSet: { members: req.user.id } });
  invitation.status = 'accepted';
  invitation.respondedAt = new Date();
  await invitation.save();

  joinProjectRoom(req.user.id, project.id);
  emitToProject(project.id, 'member:joined', { projectId: project.id, user: req.user });

  const others = [project.owner, ...project.members].filter((id) => !id.equals(req.user.id));
  await notifyUsers(others, {
    type: 'member_joined',
    text: `${req.user.name} è entrato nel progetto "${project.title}"`,
    project: project.id,
  });

  res.json({ project: { _id: project.id, title: project.title } });
}

async function declineInvitation(req, res) {
  const invitation = await findMyPendingInvitation(req);
  const project = await Project.findById(invitation.project);

  invitation.status = 'declined';
  invitation.respondedAt = new Date();
  await invitation.save();

  if (project) {
    await notifyUser(project.owner, {
      type: 'invitation_declined',
      text: `${req.user.name} ha rifiutato l'invito al progetto "${project.title}"`,
      project: project.id,
    });
  }
  res.json({ message: 'Invito rifiutato' });
}

// ---------- Rimozione e uscita ----------

// Effetti dell'uscita di un membro: i suoi task tornano senza assegnatario (e le bacheche si aggiornano live),
// l'evento arriva anche a lui, poi perde l'accesso alla room del progetto.
async function detachMember(project, userId) {
  await Project.updateOne({ _id: project.id }, { $pull: { members: userId } });

  const tasks = await Task.find({ project: project.id, assignee: userId });
  await Task.updateMany({ project: project.id, assignee: userId }, { assignee: null });
  tasks.forEach((task) => {
    task.assignee = null;
    emitToProject(project.id, 'task:updated', task);
  });

  emitToProject(project.id, 'member:removed', { projectId: project.id, userId: String(userId) });
  leaveProjectRoom(userId, project.id);
}

async function removeMember(req, res) {
  const { project } = req;
  const { userId } = req.params;

  if (project.owner.equals(userId)) throw new AppError(400, 'Il proprietario non può essere rimosso');
  if (!project.members.some((m) => m.equals(userId))) throw new AppError(404, 'Questo utente non è un membro del progetto');

  await detachMember(project, userId);
  await notifyUser(userId, {
    type: 'member_removed',
    text: `Sei stato rimosso dal progetto "${project.title}"`,
  });
  res.json({ message: 'Membro rimosso' });
}

async function leaveProject(req, res) {
  const { project } = req;
  if (req.isOwner) throw new AppError(400, 'Il proprietario non può lasciare il progetto: puoi archiviarlo o eliminarlo');

  await detachMember(project, req.user.id);
  await notifyUser(project.owner, {
    type: 'member_left',
    text: `${req.user.name} ha lasciato il progetto "${project.title}"`,
    project: project.id,
  });
  res.json({ message: 'Hai lasciato il progetto' });
}

module.exports = {
  createInvitation,
  listProjectInvitations,
  cancelInvitation,
  myInvitations,
  acceptInvitation,
  declineInvitation,
  removeMember,
  leaveProject,
  populatedProject,
};
