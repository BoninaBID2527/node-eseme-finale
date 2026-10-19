const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const migrate = require('./config/migrate');
const initSockets = require('./sockets');
const { port } = require('./config/env');

async function start() {
  await connectDB();
  await migrate();
  const server = http.createServer(app);
  initSockets(server);
  server.listen(port, () => console.log(`TaskFlow API in ascolto su http://localhost:${port}`));
}

start().catch((err) => {
  console.error('Avvio fallito:', err.message);
  process.exit(1);
});
