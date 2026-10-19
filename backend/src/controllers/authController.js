const bcrypt = require('bcryptjs');
const User = require('../models/User');
const RevokedToken = require('../models/RevokedToken');
const AppError = require('../utils/AppError');
const { signToken } = require('../utils/token');
const { Validator } = require('../utils/validate');
const { disconnectUser } = require('../sockets/emit');

const MIN_PASSWORD = 8;

async function register(req, res) {
  const v = new Validator();
  const name = v.text('name', req.body.name, { label: 'Il nome', required: true, max: 60 });
  const email = v.email('email', req.body.email);
  const password = req.body.password;
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    v.fail('password', `La password deve avere almeno ${MIN_PASSWORD} caratteri`);
  }
  v.throwIfErrors();

  if (await User.exists({ email })) {
    throw new AppError(409, 'Esiste già un utente con questa email', { email: 'Esiste già un utente con questa email' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });

  res.status(201).json({ token: signToken(user), user });
}

async function login(req, res) {
  const v = new Validator();
  const email = v.text('email', req.body.email, { label: 'L\'email', required: true }).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!password) v.fail('password', 'La password è obbligatoria');
  v.throwIfErrors();

  const user = await User.findOne({ email });
  // Stesso messaggio per email e password errate, per non rivelare quali email esistono.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, 'Email o password non corretti');
  }
  if (user.blocked) throw new AppError(403, 'Il tuo account è stato bloccato');

  res.json({ token: signToken(user), user });
}

// Il JWT è stateless: il logout ne salva l'id (jti) tra i token revocati fino alla scadenza
// e chiude le connessioni live aperte con quel token.
async function logout(req, res) {
  const { jti, exp } = req.tokenPayload;
  await RevokedToken.create({ jti, expiresAt: new Date(exp * 1000) });
  await disconnectUser(req.user.id, { reason: 'logout', jti });
  res.json({ message: 'Logout effettuato' });
}

const me = (req, res) => res.json({ user: req.user });

async function updateProfile(req, res) {
  const v = new Validator();
  const name = v.text('name', req.body.name, { label: 'Il nome', required: true, max: 60 });
  v.throwIfErrors();

  req.user.name = name;
  await req.user.save();
  res.json({ user: req.user });
}

// Cambio password: i token emessi prima non valgono più (vedi authenticateToken) e ne viene restituito uno nuovo.
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const v = new Validator();
  if (typeof currentPassword !== 'string' || !currentPassword) v.fail('currentPassword', 'Inserisci la password attuale');
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD) {
    v.fail('newPassword', `La nuova password deve avere almeno ${MIN_PASSWORD} caratteri`);
  }
  v.throwIfErrors();

  if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) {
    throw new AppError(400, 'La password attuale non è corretta', { currentPassword: 'La password attuale non è corretta' });
  }

  req.user.passwordHash = await bcrypt.hash(newPassword, 10);
  req.user.passwordChangedAt = new Date();
  await req.user.save();
  await disconnectUser(req.user.id, { reason: 'password' });

  res.json({ token: signToken(req.user), user: req.user });
}

module.exports = { register, login, logout, me, updateProfile, changePassword };
