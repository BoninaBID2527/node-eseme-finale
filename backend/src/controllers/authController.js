const bcrypt = require('bcryptjs');
const User = require('../models/User');
const RevokedToken = require('../models/RevokedToken');
const AppError = require('../utils/AppError');
const { signToken } = require('../utils/token');
const { requiredText } = require('../utils/validate');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register(req, res) {
  const name = requiredText(req.body.name, 'Il nome', 60);
  const email = requiredText(req.body.email, 'L\'email', 120).toLowerCase();
  const password = req.body.password;

  if (!EMAIL_REGEX.test(email)) throw new AppError(400, 'Email non valida');
  if (typeof password !== 'string' || password.length < 6) {
    throw new AppError(400, 'La password deve avere almeno 6 caratteri');
  }
  if (await User.exists({ email })) throw new AppError(409, 'Esiste già un utente con questa email');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });

  res.status(201).json({ token: signToken(user), user });
}

async function login(req, res) {
  const email = requiredText(req.body.email, 'L\'email').toLowerCase();
  const password = requiredText(req.body.password, 'La password');

  const user = await User.findOne({ email });
  // Stesso messaggio per email e password errate, per non rivelare quali email esistono.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, 'Credenziali non valide');
  }
  if (user.blocked) throw new AppError(403, 'Utente bloccato');

  res.json({ token: signToken(user), user });
}

// Il JWT è stateless: il logout ne salva l'id (jti) tra i token revocati fino alla scadenza.
async function logout(req, res) {
  const { jti, exp } = req.tokenPayload;
  await RevokedToken.create({ jti, expiresAt: new Date(exp * 1000) });
  res.json({ message: 'Logout effettuato' });
}

function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, logout, me };
