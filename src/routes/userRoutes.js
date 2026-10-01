const express = require('express');
const router = express.Router();

const isAuthenticated = require('../middleware/isAuthenticated');
const { lookupByEmail, getMe, updateMe, changePassword, updateAvatar } = require('../controllers/userController');
const uploadAvatar = require('../middleware/uploadAvatar');
const { logout } = require('../controllers/loginController');

router.use(isAuthenticated);

router.get('/lookup', lookupByEmail);
router.get('/me', getMe);
router.patch('/me', updateMe);
router.patch('/me/password', changePassword);
router.post('/me/avatar', uploadAvatar, updateAvatar);
router.post('/logout', logout);

module.exports = router;