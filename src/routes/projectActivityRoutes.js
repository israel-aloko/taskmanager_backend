const express = require('express');
//mergerParams lets this router read :projectId from the parent router
//it gets mounted under (e.g. app.use('/api/projects/:projectId/activity', ...)).
const router = express.Router({ mergeParams: true });

const isAuthenticated = require('../middleware/isAuthenticated');
const { requireProjectMember } = require('../middleware/projectAuth');
const { getProjectActivity } = require('../controllers/activityController');

//GET /api/projects/:projectId/activity - any project member
router.get('/', isAuthenticated, requireProjectMember, getProjectActivity);

module.exports = router;