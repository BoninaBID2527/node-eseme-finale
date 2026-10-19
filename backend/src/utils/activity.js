const Activity = require('../models/Activity');
const { emitToProject } = require('../sockets/emit');

// Registra un'attività nel progetto e la invia in tempo reale ai membri connessi.
// Un errore nel registro non deve mai far fallire l'azione principale: si segnala e si prosegue.
async function logActivity({ project, actor, type, text, task }) {
  try {
    const activity = await Activity.create({ project: project.id || project, actor: actor.id || actor, type, text, task });
    await activity.populate('actor', 'name');
    emitToProject(project.id || project, 'activity:new', activity);
    return activity;
  } catch (err) {
    console.error('Registro attività non aggiornato:', err.message);
    return null;
  }
}

module.exports = { logActivity };
