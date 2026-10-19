const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const RevokedToken = require('../models/RevokedToken');
const User = require('../models/User');
const AppError = require('./AppError');

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, {
    expiresIn: jwtExpiresIn,
    jwtid: crypto.randomUUID(),
  });
}

// Verifica firma, revoca (logout) e blocco dell'utente. Usata da REST e Socket.IO.
async function authenticateToken(token) {
  if (!token) throw new AppError(401, 'Token mancante');

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    throw new AppError(401, 'Token non valido o scaduto');
  }

  if (await RevokedToken.exists({ jti: payload.jti })) {
    throw new AppError(401, 'Sessione terminata, effettua di nuovo il login');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new AppError(401, 'Utente non trovato');
  if (user.blocked) throw new AppError(403, 'Utente bloccato');

  return { user, payload };
}

module.exports = { signToken, authenticateToken };
