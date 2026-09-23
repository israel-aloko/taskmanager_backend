const express = require('express');
const router = express.Router();

const isAuthenticated = require('../middleware/isAuthenticated');
const { editComment, deleteComment } = require('../controllers/commentController');

router.patch('/:commentId', isAuthenticated, editComment);
router.delete('/:commentId', isAuthenticated, deleteComment);

module.exports = router;