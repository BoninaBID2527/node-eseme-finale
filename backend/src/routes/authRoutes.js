const router = require('express').Router();
const { auth } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const ctrl = require('../controllers/authController');

// Limiti anti forza bruta: 10 tentativi di login ogni 15 minuti per IP+email, 20 registrazioni l'ora per IP.
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, key: (req) => `${req.ip}|${String(req.body.email).toLowerCase()}` });
const registerLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, key: (req) => req.ip });

router.post('/register', registerLimit, ctrl.register);
router.post('/login', loginLimit, ctrl.login);
router.post('/logout', auth, ctrl.logout);
router.get('/me', auth, ctrl.me);
router.patch('/me', auth, ctrl.updateProfile);
router.patch('/password', auth, ctrl.changePassword);

module.exports = router;
