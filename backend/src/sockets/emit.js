const Notification = require('../models/Notification');

// Il riferimento a io viene impostato all'avvio; nei test REST resta vuoto e gli emit non fanno nulla.
let io = null;

function setIO(instance) {
  io = instance;
}

const projectRoom = (id) => `project:${id}`;
const userRoom = (id) => `user:${id}`;

function emitToProject(projectId, event, payload) {
  if (io) io.to(projectRoom(projectId)).emit(event, payload);
}

function emitToUser(userId, event, payload) {
  if (io) io.to(userRoom(userId)).emit(event, payload);
}

// Fa entrare/uscire subito i socket già connessi di un utente dalla room del progetto.
function joinProjectRoom(userId, projectId) {
  if (io) io.in(userRoom(userId)).socketsJoin(projectRoom(projectId));
}

function leaveProjectRoom(userId, projectId) {
  if (io) io.in(userRoom(userId)).socketsLeave(projectRoom(projectId));
}

// Toglie dalla room tutti i socket tranne quelli degli utenti indicati (es. il proprietario).
async function evictFromProject(projectId, keepUserIds = []) {
  if (!io) return;
  const keep = new Set(keepUserIds.map(String));
  const sockets = await io.in(projectRoom(projectId)).fetchSockets();
  sockets.forEach((s) => {
    if (!keep.has(String(s.data.userId))) s.leave(projectRoom(projectId));
  });
}

// Chiude i socket di un utente (tutti, oppure solo quello di un token) dopo aver avvisato il client.
async function disconnectUser(userId, { reason, jti } = {}) {
  if (!io) return;
  const sockets = await io.in(userRoom(userId)).fetchSockets();
  sockets
    .filter((s) => !jti || s.data.jti === jti)
    .forEach((s) => {
      s.emit('session:ended', { reason });
      s.disconnect(true);
    });
}

// Salva la notifica nel DB e la invia in tempo reale al destinatario.
async function notifyUser(userId, { type, text, project, task, invitation }) {
  const notification = await Notification.create({ user: userId, type, text, project, task, invitation });
  emitToUser(userId, 'notification:new', notification);
  return notification;
}

const notifyUsers = (userIds, data) => Promise.all(userIds.map((id) => notifyUser(id, data)));

module.exports = {
  setIO,
  emitToProject,
  emitToUser,
  joinProjectRoom,
  leaveProjectRoom,
  evictFromProject,
  disconnectUser,
  notifyUser,
  notifyUsers,
};
