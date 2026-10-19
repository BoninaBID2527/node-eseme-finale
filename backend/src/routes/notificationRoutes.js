const router = require('express').Router();
const { auth } = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const ctrl = require('../controllers/notificationController');

router.param('id', validateId);
router.use(auth);

router.get('/', ctrl.listNotifications);
router.get('/unread-count', ctrl.unreadCount);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);

module.exports = router;
