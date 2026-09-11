const express = require('express');
const router = express.Router();

const isAuthenticated = require('../middleware/isAuthenticated');
const { lookupByEmail } = require('../controllers/userController');

router.use(isAuthenticated);

router.get('/lookup', lookupByEmail);

module.exports = router;