const express = require('express');
const router = express.Router();

const isAuthenticated = require('../middleware/isAuthenticated');
const { getMyInvites, getInviteByToken, acceptInvite, declineInvite } = require('../controllers/inviteController');

//GET /:token first (with token="mine"), since Express matches routes top-to-bottom.'
router.get('/mine', isAuthenticated, getMyInvites);

//Public - not authentication required, so a logged-out visitor can see who invited them
//before being asked to log in.
router.get('/:token', getInviteByToken);

router.use(isAuthenticated);

router.post('/:token/accept', acceptInvite);
router.post('/:token/decline', declineInvite);

module.exports = router;