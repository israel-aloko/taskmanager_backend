const express = require('express');
const router = express.Router();

const isAuthenticated = require('../middleware/isAuthenticated');
const { requireProjectMember, requireProjectAdmin } = require('../middleware/projectAuth');

const {
    createProject,
    getMyProjects,
    getProjectById,
    updateProject,
    deleteProject,
    removeMember,
} = require('../controllers/projectController');

//All project routes require the user to be logged in.
router.use(isAuthenticated);

router.post('/', createProject);
router.get('/', getMyProjects);

router.get('/:id', requireProjectMember, getProjectById);
router.patch('/:id', requireProjectMember, requireProjectAdmin, updateProject);
router.delete('/:id', requireProjectMember, requireProjectAdmin, deleteProject);

router.delete('/:id/members/:userId', requireProjectMember, requireProjectAdmin, removeMember);

module.exports = router;