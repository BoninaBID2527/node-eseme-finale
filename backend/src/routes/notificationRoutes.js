const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { listNotifications, markRead, markAllRead } = require('../controllers/notificationController');

router.use(auth);
router.get('/', listNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

module.exports = router;
