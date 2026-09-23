const express = require('express');
const router = express.Router({ mergeParams: true });

const isAuthenticated = require('../middleware/isAuthenticated');
const { createComment, getComments } = require('../controllers/commentController');

router.post('/', isAuthenticated, createComment);
router.get('/', isAuthenticated, getComments);

module.exports = router;