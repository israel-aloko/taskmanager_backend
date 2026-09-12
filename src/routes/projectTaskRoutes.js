const express = require('express');
// mergeParams lets this router read :projectId from the parent router
// it gets mounted under (e.g. app.use('/api/projects/:projectId/tasks', ...)).
const router = express.Router({ mergeParams: true });

const isAuthenticated = require('../middleware/isAuthenticated');
const { requireProjectMember, requireProjectAdmin } = require('../middleware/projectAuth');
const {
    createTask,
    getProjectTasks,
} = require('../controllers/taskController');

// POST /api/projects/:projectId/tasks — admin only
router.post('/', isAuthenticated, requireProjectMember, requireProjectAdmin, createTask);

// GET /api/projects/:projectId/tasks — any project member (board view)
router.get('/', isAuthenticated, requireProjectMember, getProjectTasks);

module.exports = router;