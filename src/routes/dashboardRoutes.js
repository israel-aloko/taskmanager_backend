const express = require('express');
const router = express.Router();

const { getDashboard } = require('../controllers/dashboardController');
const isAuthenticated = require('../middleware/isAuthenticated');

router.get('/', isAuthenticated, getDashboard);

module.exports = router;