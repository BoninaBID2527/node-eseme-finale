const router = require('express').Router();
const { auth, requireAdmin } = require('../middleware/auth');
const { listReports, listUsers, hideProject, blockUser } = require('../controllers/adminController');

router.use(auth, requireAdmin);
router.get('/reports', listReports);
router.get('/users', listUsers);
router.patch('/projects/:id/hide', hideProject);
router.patch('/users/:id/block', blockUser);

module.exports = router;
