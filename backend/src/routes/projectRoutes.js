const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { loadProject, canView, requireMember, requireOwner, requireWritable } = require('../middleware/projectAccess');
const { uploadCover } = require('../middleware/upload');
const validateId = require('../middleware/validateId');
const projects = require('../controllers/projectController');
const members = require('../controllers/memberController');
const tasks = require('../controllers/taskController');
const chat = require('../controllers/chatController');
const { reportProject } = require('../controllers/reportController');

router.param('id', validateId);
router.param('taskId', validateId);
router.param('invId', validateId);
router.param('userId', validateId);

// Il catalogo pubblico è consultabile anche senza login.
router.get('/public', projects.listPublic);
router.get('/public/filters', projects.publicFilters);

// Da qui in poi serve il login.
router.use(auth);

router.get('/mine', projects.listMine);
router.post('/', uploadCover, projects.createProject);

// Tutte le rotte con :id caricano il progetto e i ruoli dell'utente. Ogni riga dichiara chi può usarla:
//   canView = chi può vedere la panoramica · requireMember = bacheca e chat · requireOwner = gestione
//   requireWritable = il progetto non deve essere archiviato né oscurato
router.get('/:id', loadProject, canView, projects.getProject);
router.put('/:id', loadProject, requireOwner, requireWritable, uploadCover, projects.updateProject);
router.patch('/:id/archive', loadProject, requireOwner, projects.archiveProject);
router.delete('/:id', loadProject, requireOwner, projects.deleteProject);

router.get('/:id/invitations', loadProject, requireOwner, members.listProjectInvitations);
router.post('/:id/invitations', loadProject, requireOwner, requireWritable, members.createInvitation);
router.delete('/:id/invitations/:invId', loadProject, requireOwner, members.cancelInvitation);
router.delete('/:id/members/:userId', loadProject, requireOwner, requireWritable, members.removeMember);
router.post('/:id/leave', loadProject, requireMember, requireWritable, members.leaveProject);

router.get('/:id/tasks', loadProject, requireMember, tasks.listTasks);
router.post('/:id/tasks', loadProject, requireMember, requireWritable, tasks.createTask);
router.put('/:id/tasks/:taskId', loadProject, requireMember, requireWritable, tasks.updateTask);
router.patch('/:id/tasks/:taskId/status', loadProject, requireMember, requireWritable, tasks.moveTask);
router.patch('/:id/tasks/:taskId/assignee', loadProject, requireMember, requireWritable, tasks.assignTask);
router.delete('/:id/tasks/:taskId', loadProject, requireMember, requireWritable, tasks.deleteTask);

router.get('/:id/messages', loadProject, requireMember, chat.listMessages);
router.post('/:id/messages', loadProject, requireMember, requireWritable, chat.sendMessage);

router.post('/:id/report', loadProject, canView, reportProject);

module.exports = router;
