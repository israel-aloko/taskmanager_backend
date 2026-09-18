const express = require('express');
const router = express.Router();

const isAuthenticated = require('../middleware/isAuthenticated')
const { getMyNotifications, markAllAsRead, markAsRead } = require('../controllers/notificationController');

router.get('/mine', isAuthenticated, getMyNotifications)
router.patch('/:id/read', isAuthenticated, markAsRead)
router.patch('/read-all', isAuthenticated, markAllAsRead)

module.exports = router