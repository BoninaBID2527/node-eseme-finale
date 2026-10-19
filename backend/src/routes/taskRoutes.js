const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { myTasks } = require('../controllers/taskController');

// I task assegnati all'utente loggato, su tutti i progetti.
router.get('/mine', auth, myTasks);

module.exports = router;
