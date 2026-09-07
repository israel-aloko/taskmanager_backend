const express = require('express');
const router = express.Router();
const { register, verify } = require('../controllers/registerController');

router.post('/register', register);
router.post('/verify', verify);

module.exports = router;