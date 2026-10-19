const { Server } = require('socket.io');
const Project = require('../models/Project');
const { authenticateToken } = require('../utils/token');
const { clientUrl } = require('../config/env');
const { setIO } = require('./emit');

// Il client si connette con io({ auth: { token } }). Il server verifica il JWT e lo mette nelle sue room:
//   user:<id>     notifiche e inviti personali
//   project:<id>  eventi di ogni progetto di cui l'utente fa parte (i progetti oscurati solo al proprietario)
// Chi viene rimosso, bloccato o fa logout viene tolto dalle room o disconnesso da emit.js.
function initSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: clientUrl } });

  io.use(async (socket, next) => {
    try {
      const { user, payload } = await authenticateToken(socket.handshake.auth && socket.handshake.auth.token);
      socket.data = { userId: user.id, jti: payload.jti };
      socket.user = user;

      // La connessione non deve sopravvivere alla scadenza del token.
      const timer = setTimeout(() => {
        socket.emit('session:ended', { reason: 'expired' });
        socket.disconnect(true);
      }, Math.max(payload.exp * 1000 - Date.now(), 0));
      timer.unref();
      socket.once('disconnect', () => clearTimeout(timer));

      next();
    } catch (err) {
      next(new Error(err.message));
    }
  });

  io.on('connection', async (socket) => {
    const { user } = socket;
    socket.join(`user:${user.id}`);

    const projects = await Project.find({ $or: [{ owner: user.id }, { members: user.id }] }).select('_id owner status');
    projects
      .filter((p) => p.status !== 'hidden' || p.owner.equals(user.id))
      .forEach((p) => socket.join(`project:${p.id}`));
  });

  setIO(io);
  return io;
}

module.exports = initSockets;
