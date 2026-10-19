const { Server } = require('socket.io');
const Project = require('../models/Project');
const { authenticateToken } = require('../utils/token');
const { clientUrl } = require('../config/env');
const { setIO } = require('./emit');

// Il client si connette con io(url, { auth: { token } }). Il server lo mette nelle sue room:
// user:<id> (notifiche personali) e project:<id> per ogni progetto di cui fa parte.
function initSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: clientUrl } });

  io.use(async (socket, next) => {
    try {
      const { user } = await authenticateToken(socket.handshake.auth && socket.handshake.auth.token);
      socket.user = user;
      next();
    } catch (err) {
      next(new Error(err.message));
    }
  });

  io.on('connection', async (socket) => {
    const { user } = socket;
    socket.join(`user:${user.id}`);

    const projects = await Project.find({ $or: [{ owner: user.id }, { members: user.id }] }).select('_id');
    projects.forEach((p) => socket.join(`project:${p.id}`));
  });

  setIO(io);
  return io;
}

module.exports = initSockets;
