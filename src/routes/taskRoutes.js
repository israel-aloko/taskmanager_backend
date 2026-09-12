const express = require('express');
const { getMyTasks, getTaskById, updateTask, updateTaskStatus, deleteTask } = require('../controllers/taskController');
const isAuthenticated = require('../middleware/isAuthenticated');
const { requireTaskProjectMember, requireTaskAdminOrAssignee } = require('../middleware/taskAuth');
const { requireProjectAdmin } = require('../middleware/projectAuth');
const router = express.Router();

//GET /api/tasks/mine - must be declared before /:taskId, or Express will
//treat "mine" as a taskId and hand it to Task.findById, throwing a CastError.
router.get('/mine', isAuthenticated, getMyTasks);

//GET /api/tasks/taskId - any project member
router.get('/:taskId', isAuthenticated, requireTaskProjectMember, getTaskById);

//PATCH /api/tasks/:taskId - admin only (title/description/assignedTo/priority/deadline)
router.patch('/:taskId', isAuthenticated, requireTaskProjectMember, requireProjectAdmin, updateTask);

//PATCH /api/tasks/:taskId/status - admin OR the assignee
router.patch('/:taskId/status', isAuthenticated, requireTaskProjectMember, requireTaskAdminOrAssignee, updateTaskStatus);

//DELETE /api/tasks/:taskId - admin only
router.delete('/:taskId', isAuthenticated, requireTaskProjectMember, requireProjectAdmin, deleteTask);

module.exports = router;
