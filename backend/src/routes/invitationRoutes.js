const router = require('express').Router();
const { auth } = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const members = require('../controllers/memberController');

router.param('id', validateId);
router.use(auth);

// Inviti ricevuti dall'utente loggato.
router.get('/', members.myInvitations);
router.post('/:id/accept', members.acceptInvitation);
router.post('/:id/decline', members.declineInvitation);

module.exports = router;
