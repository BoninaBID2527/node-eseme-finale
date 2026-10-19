const mongoose = require('mongoose');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Invitation = require('../models/Invitation');
const { attachProgress } = require('../utils/projectData');
const { visibleProjectIds, startOfToday } = require('./taskController');

// Riepilogo personale: tutti i numeri sono calcolati dal database sui dati reali dell'utente.
async function getDashboard(req, res) {
  const me = new mongoose.Types.ObjectId(req.user.id);
  const today = startOfToday();
  const weekEnd = new Date(today.getTime() + 8 * 86400000);
  const projectIds = await visibleProjectIds(me);
  const open = { assignee: me, project: { $in: projectIds }, status: { $ne: 'done' } };
  const populateProject = (query) => query.populate('project', 'title status');

  const [created, memberOf, openTasks, overdueCount, weekCount, overdue, upcoming, recent, invitations] = await Promise.all([
    Project.countDocuments({ owner: me }),
    Project.countDocuments({ members: me, $nor: [{ status: 'hidden' }] }),
    Task.countDocuments(open),
    Task.countDocuments({ ...open, dueDate: { $lt: today } }),
    Task.countDocuments({ ...open, dueDate: { $gte: today, $lt: weekEnd } }),
    populateProject(Task.find({ ...open, dueDate: { $lt: today } }).sort({ dueDate: 1 }).limit(5)),
    populateProject(Task.find({ ...open, dueDate: { $gte: today } }).sort({ dueDate: 1 }).limit(6)),
    Project.find({ _id: { $in: projectIds } }).sort({ updatedAt: -1 }).limit(6).populate('owner', 'name'),
    Invitation.find({ invitee: me, status: 'pending' }).sort({ createdAt: -1 }).populate('project', 'title status').populate('inviter', 'name'),
  ]);

  const pending = invitations.filter((i) => i.project && i.project.status === 'active');
  res.json({
    stats: { created, memberOf, openTasks, overdue: overdueCount, dueThisWeek: weekCount, pendingInvitations: pending.length },
    overdue,
    upcoming,
    recentProjects: await attachProgress(recent),
    invitations: pending,
  });
}

module.exports = { getDashboard };
