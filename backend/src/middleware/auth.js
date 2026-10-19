const { authenticateToken } = require('../utils/token');
const AppError = require('../utils/AppError');

// Richiede "Authorization: Bearer <token>" e mette l'utente in req.user.
async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const { user, payload } = await authenticateToken(token);
  req.user = user;
  req.tokenPayload = payload;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') throw new AppError(403, 'Accesso riservato agli amministratori');
  next();
}

module.exports = { auth, requireAdmin };
