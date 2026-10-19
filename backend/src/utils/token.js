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

// Verifica firma, scadenza, revoca (logout), blocco e cambio password. Usata da REST e Socket.IO.
async function authenticateToken(token) {
  if (!token) throw new AppError(401, 'Token mancante', undefined, 'session_invalid');

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch (err) {
    throw new AppError(401, err.name === 'TokenExpiredError' ? 'Sessione scaduta, accedi di nuovo' : 'Token non valido', undefined, 'session_invalid');
  }

  if (await RevokedToken.exists({ jti: payload.jti })) {
    throw new AppError(401, 'Sessione terminata, accedi di nuovo', undefined, 'session_invalid');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new AppError(401, 'Utente non trovato', undefined, 'session_invalid');
  if (user.blocked) throw new AppError(403, 'Il tuo account è stato bloccato', undefined, 'account_blocked');
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
    throw new AppError(401, 'La password è cambiata, accedi di nuovo', undefined, 'session_invalid');
  }

  return { user, payload };
}

module.exports = { signToken, authenticateToken };
