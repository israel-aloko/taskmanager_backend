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
    updateMemberRole,
    leaveProject,
    completeProject,
    reopenProject,
} = require('../controllers/projectController');

const {sendInvite} = require('../controllers/inviteController');

const {
    getJoinCode,
    regenerateJoinCode,
    requestToJoin,
    lookupByJoinCode,
    getJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
} = require('../controllers/joinController');

//All project routes require the user to be logged in.
router.use(isAuthenticated);

router.post('/', createProject);
router.get('/', getMyProjects);
router.post('/join', requestToJoin);
router.get('/lookup', lookupByJoinCode);

router.get('/:id', requireProjectMember, getProjectById);
router.patch('/:id', requireProjectMember, requireProjectAdmin, updateProject);
router.delete('/:id', requireProjectMember, requireProjectAdmin, deleteProject);

router.delete('/:id/members/:userId', requireProjectMember, requireProjectAdmin, removeMember);
router.patch('/:id/members/:userId/role', requireProjectMember, requireProjectAdmin, updateMemberRole);

router.post('/:id/invites', requireProjectMember, requireProjectAdmin, sendInvite);

router.get('/:id/join-code', requireProjectMember, requireProjectAdmin, getJoinCode);
router.post('/:id/regenerate-code', requireProjectMember, requireProjectAdmin, regenerateJoinCode);
router.get('/:id/join-requests', requireProjectMember, requireProjectAdmin, getJoinRequests);
router.post('/:id/join-requests/:reqId/approve', requireProjectMember, requireProjectAdmin, approveJoinRequest);
router.post('/:id/join-requests/:reqId/reject', requireProjectMember, requireProjectAdmin, rejectJoinRequest);

router.post('/:id/leave', requireProjectMember, leaveProject);

router.patch('/:id/complete', requireProjectMember, requireProjectAdmin, completeProject);
router.patch('/:id/reopen', requireProjectMember, requireProjectAdmin, reopenProject);

module.exports = router;