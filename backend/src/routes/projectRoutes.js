const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { loadProject, canView, requireMember, requireOwner } = require('../middleware/projectAccess');
const { uploadCover } = require('../middleware/upload');
const projects = require('../controllers/projectController');
const members = require('../controllers/memberController');
const tasks = require('../controllers/taskController');
const chat = require('../controllers/chatController');
const { reportProject } = require('../controllers/reportController');

// Il catalogo pubblico è consultabile anche senza login.
router.get('/public', projects.listPublic);

// Da qui in poi serve il login.
router.use(auth);

router.post('/', uploadCover, projects.createProject);

// Tutte le rotte con :id caricano il progetto e i ruoli dell'utente.
router.get('/:id', loadProject, canView, projects.getProject);
router.put('/:id', loadProject, requireOwner, uploadCover, projects.updateProject);
router.patch('/:id/archive', loadProject, requireOwner, projects.archiveProject);
router.delete('/:id', loadProject, requireOwner, projects.deleteProject);

router.post('/:id/members', loadProject, requireOwner, members.addMember);
router.delete('/:id/members/:userId', loadProject, requireOwner, members.removeMember);

router.get('/:id/tasks', loadProject, requireMember, tasks.listTasks);
router.post('/:id/tasks', loadProject, requireMember, tasks.createTask);
router.put('/:id/tasks/:taskId', loadProject, requireMember, tasks.updateTask);
router.patch('/:id/tasks/:taskId/status', loadProject, requireMember, tasks.moveTask);
router.patch('/:id/tasks/:taskId/assignee', loadProject, requireMember, tasks.assignTask);
router.delete('/:id/tasks/:taskId', loadProject, requireMember, tasks.deleteTask);

router.get('/:id/messages', loadProject, requireMember, chat.listMessages);
router.post('/:id/messages', loadProject, requireMember, chat.sendMessage);

router.post('/:id/report', loadProject, canView, reportProject);

module.exports = router;
