const router = require('express').Router();
const { auth, requireAdmin } = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const ctrl = require('../controllers/adminController');

router.param('id', validateId);

// Ogni rotta admin richiede login E ruolo admin: il controllo è sul server, non solo nell'interfaccia.
router.use(auth, requireAdmin);

router.get('/stats', ctrl.stats);
router.get('/reports', ctrl.listReports);
router.patch('/reports/:id', ctrl.updateReport);
router.get('/projects', ctrl.listProjects);
router.patch('/projects/:id/hide', ctrl.hideProject);
router.get('/users', ctrl.listUsers);
router.patch('/users/:id/block', ctrl.blockUser);

module.exports = router;
