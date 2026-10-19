const Notification = require('../models/Notification');

// Il riferimento a io viene impostato all'avvio; nei test resta vuoto e gli emit non fanno nulla.
let io = null;

function setIO(instance) {
  io = instance;
}

function emitToProject(projectId, event, payload) {
  if (io) io.to(`project:${projectId}`).emit(event, payload);
}

function emitToUser(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload);
}

// Fa entrare/uscire subito i socket già connessi di un utente dalla room del progetto.
function joinProjectRoom(userId, projectId) {
  if (io) io.in(`user:${userId}`).socketsJoin(`project:${projectId}`);
}

function leaveProjectRoom(userId, projectId) {
  if (io) io.in(`user:${userId}`).socketsLeave(`project:${projectId}`);
}

// Salva la notifica nel DB e la invia in tempo reale al destinatario.
async function notifyUser(userId, { type, text, project }) {
  const notification = await Notification.create({ user: userId, type, text, project });
  emitToUser(userId, 'notification:new', notification);
  return notification;
}

// Come notifyUser, ma per tutti gli admin (usata per le segnalazioni).
async function notifyAdmins(adminIds, data) {
  return Promise.all(adminIds.map((id) => notifyUser(id, data)));
}

module.exports = {
  setIO,
  emitToProject,
  emitToUser,
  joinProjectRoom,
  leaveProjectRoom,
  notifyUser,
  notifyAdmins,
};
