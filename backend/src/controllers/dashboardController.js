const Project = require('../models/Project');
const Task = require('../models/Task');

async function getDashboard(req, res) {
  const userId = req.user.id;

  const [created, memberOf, tasks] = await Promise.all([
    Project.find({ owner: userId }).sort({ createdAt: -1 }),
    Project.find({ members: userId }).sort({ createdAt: -1 }).populate('owner', 'name'),
    Task.find({ assignee: userId }).populate('project', 'title'),
  ]);

  // Per scadenza crescente; i task senza scadenza vanno in fondo.
  tasks.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate - b.dueDate;
  });

  res.json({ created, memberOf, tasks });
}

module.exports = { getDashboard };
